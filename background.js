const encoder = new TextEncoder(),
	  decoder = new TextDecoder('utf-8')

const getURL = map => new URL(`https://earthmc-api.herokuapp.com/api/v1/${map}/alliances`),
	  fetchAlliances = async (map) => await fetch(getURL(map)).then(res => res.json()).catch(console.error),
	  buttonEvent = () => whatIsFetched == 'meganation' ? whatIsFetched = 'alliance' : whatIsFetched = 'meganation'

var whatIsFetched = 'meganation'
browser.runtime.onMessage.addListener(buttonEvent)

const updateReq = () => ({
	listener: (details) => details.url.includes('up/world/earth/') ? onPlayerUpdate(details) : onMapUpdate(details), 
	urls: ['https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json', 
		'https://earthmc.net/map/nova/up/world/earth/*', 
		'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json', 
		'https://earthmc.net/map/aurora/up/world/earth/*']
}, ['blocking'])

// Listens for requests.
browser.webRequest.onBeforeRequest.addListener(updateReq)

// Function is fired when the marker_earth request is sent.
function onMapUpdate(details) {
	const usedMap = details.url.includes('nova') ? 'nova' : 'aurora',
		  filter = browser.webRequest.filterResponseData(details.requestId),
		  arrayBuffer = []

	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}))
	filter.onstop = () => {
		// Decode the response.
		arrayBuffer.push(decoder.decode())
		const data = JSON.parse(arrayBuffer.join(''))

		// Check if response is undefined and delete star icons.
		if (!data.sets) return
		delete data.sets["townyPlugin.markerset"].markers

		let towns = Object.values(data.sets["townyPlugin.markerset"].areas)
		fetchAlliances(usedMap).then(meganations => {
			towns.forEach(town => {
				// Settings for every town.
				town.weight = 1.6
				town.opacity = 1

				townTitle = town.desc.split('<br \/>')[0].replace(/\(Shop\)$/g, '').replaceAll(/[()]/g, '').split(' ')
				const nation = townTitle[2].toLowerCase().replace('</span>', '')

				// Set every town's color to default.
				town.color = town.fillcolor = '#3FB4FF'
				if (nation.length < 1) return town.color = town.fillcolor = '#89C500'

				// Get rid of an array and brackets.
				var meganationList = ''

				// Check if town's nation is in any meganation.
				meganations.forEach(meganation => {
					if (meganation.type != whatIsFetched) return
					// Nation controlled by multiple meganations support.
					if (!meganation.nations.includes(nation)) return
					meganationList += meganationList.length < 1 ? meganation.name : ', ' + meganation.name

					// If yes, apply fill color (and stroke color if defined).
					town.color = meganation.color.length == 2 ? meganation.color[1] : fillColor
					town.fillcolor = meganation.color[0]
				})
					
				// Apply description.
				if (meganationList.length > 0) town.desc = town.desc.replace(')</span><br />', ')</span><br /> ' + 
					'<span style=\"font-size:80%\">Part of</span> ' + 
					'<span style=\"font-size:90%\"><b>' + meganationList + '</b></span><br />')
			})

			// Send the modified response and close the filter.
			filter.write(encoder.encode(JSON.stringify(data)))
			filter.close()
		})
	}
}

// Fired each ~1 second when the update request is sent.
function onPlayerUpdate(details) {
	const filter = browser.webRequest.filterResponseData(details.requestId),
		  arrayBuffer = []

	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}))
	filter.onstop = () => {
		arrayBuffer.push(decoder.decode())

		const string = arrayBuffer.join(''),
			  data = JSON.parse(string)

		// If response's length > 64 kB then trigger onMapUpdate(), otherwise write data to the filter
		if (!data.currentcount) return

		string.length < 65536 ? filter.write(encoder.encode(JSON.stringify(data))) : onMapUpdate(details)
		filter.close()
	}
}
