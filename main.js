const { fetch: originalFetch } = window
const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"><span id="player-lookup-online" style="color: {online-color}">{online}</span><br><img id="player-lookup-avatar"/><center><b id="player-lookup-name">{player}</b>{about}</center><hr>Rank: <b>{rank}</b><br>Balance: <b>{balance} gold</b><br><span class="close-container">X</span></div>',
	partOf: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayer(\'{player}\')">{player}</span>',
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading" style="width: auto">Loading...</button>',
	alert: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>'
}

let alliances = null
const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)

function sendAlert(message) {
	if (document.querySelector('#alert') != null) document.querySelector('#alert').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.alert)
	const alertMessage = document.querySelector('#alert-message')
	alertMessage.innerHTML = alertMessage.innerHTML.replace('{message}', message)
	document.querySelector('#alert-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

function modifySettings(data) {
	data['player_tracker'].nameplates['show_heads'] = true
	data['player_tracker'].nameplates['heads_url'] = 'https://mc-heads.net/avatar/{uuid}/16'
	data.zoom.def = 0
	// Set camera on Europe
	data.spawn.x = 2000
	data.spawn.z = -10000
	return data
}

function roundTo16(number) {
	return Math.round(number / 16) * 16
}

// Fowler-Noll-Vo hash function
function hashCode(string) {
	let hexValue = 0x811c9dc5
	for (let i = 0; i < string.length; i++) {
		hexValue ^= string.charCodeAt(i)
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24)
	}
	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0')
}

// Shoelace formula
function getArea(vertices) {
    const n = vertices.length
    let area = 0

	// Vertices need rounding to 16 because data has imprecise coordinates
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
        area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
    }

    return (Math.abs(area) / 2) / (16 * 16)
}

function modifyDescription(marker) {
	// Gather some information
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	let councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1].split(', ')
	councillors = councillors.filter(councillor => councillor != 'None')
	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents.split(', ').length
	// Deprecated: const wealth = marker.popup.match(/Wealth: <b>(\d+)G/)?.[1]
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null
	const nationAlliances = getNationAlliances(nation)

	// Calculate town's area
	let area = 0
	if (marker.type == 'polygon') {
		for (const region of marker.points) {
			const vertices = []
			for (const vertex of region[0]) { vertices.push(vertex) }
			area += getArea(vertices)
		}
	}

	// Modify resident list
	const residentList = residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorsList = councillors.map(councillor => htmlCode.residentClickable.replaceAll('{player}', councillor)).join(', ')
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, htmlCode.scrollableResidentList.replace('{list}', residentList))
	}
	else {
		marker.popup = marker.popup.replace(residents + '\n', htmlCode.residentList.replace('{list}', residentList) + '\n')
	}

	// Modify popup
	marker.popup = marker.popup
		.replace('</details>\n   \t<br>', '</details>') // Remove line break
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`) // Add size info
		// Deprecated: .replace(/Wealth: <b>(\d+)G/, `Wealth: <b>${wealth} gold`) // Replace 'G' with 'gold'
		// Deprecated: .replace('Wealth: <b>0 gold</b>\n\t<br>', '') // Remove 0 gold wealth info
		.replace('<i>/town set board [msg]</i>', '<i></i>') // Remove default town board
		.replace('<i></i> \n    <br>\n', '') // Remove empty town board
		.replace('\n    <i>', '\n    <i style="overflow-wrap: break-word">') // Wrap long town board
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
		.replace('Councillors: <b>None</b>\n\t<br>', '') // Remove none councillors info
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorsList}</b>`) // Lookup councillors
		.replace('Size: <b>0 chunks</b><br/>', '') // Remove 0 chunks town size info
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>') // False
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>') // True

	if (isCapital) marker.popup = marker.popup
		.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">★ ') // Add capital star

	// Modify tooltip
	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')

	// Add part of label
	if (nationAlliances.length > 0) {
		const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
		const partOfLabel = htmlCode.partOf.replace('{allianceList}', allianceList)
		marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
	}

	return marker
}

function main(data) {
	if (currentMapMode == 'archive') {
		if (localStorage['emcdynmapplus-archive'] == undefined) {
			sendAlert('Unexpected error occurred while setting the map mode to archive, maybe the service is unavailable? Try again later.')
		} else {
			const archive = localStorage['emcdynmapplus-archive']
			data = JSON.parse(archive)
		}
	}

	if (data?.[0]?.markers?.length == 0 || !data?.[0]?.markers?.length) {
		sendAlert('Unexpected error occurred while loading the map, maybe EarthMC is down? Try again later.')
		return data
	}

	data = addChunksLayer(data)

	for (const index in data[0].markers) {
		let marker = data[0]['markers'][index]
		if (marker.type != 'polygon' && marker.type != 'icon') continue

		marker = modifyDescription(marker)

		if (marker.type != 'polygon') continue

		// Universal properties
		marker.opacity = 1
		marker.fillOpacity = 0.33
		marker.weight = 1.5

		if (currentMapMode == 'default' || currentMapMode == 'archive') continue

		marker = colorTowns(marker)
	}

	return data
}

function getNationAlliances(nation) {
	const nationAlliances = []
	if (alliances == null) return nationAlliances
	for (const alliance of alliances) {
		if (!alliance.nations.includes(nation)) continue
		if (alliance.type != currentMapMode) continue
		nationAlliances.push({name: alliance.name, colours: alliance.colours})
	}
	return nationAlliances
}

function colorTowns(marker) {
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isRuin = (mayor.match(/NPC[0-9]+/) != null)
	const isNationless = (nation == null)
	const nationHasDefaultColor = (marker.color == '#3fb4ff' && marker.fillColor == '#3fb4ff') // Default blue
	const nationAlliances = getNationAlliances(nation)

	// Universal properties for the map modes
	if (currentMapMode == 'alliances') {
		marker.color = '#000000' // Black
		marker.fillColor = '#000000'
		marker.weight = 0.5
	} else {
		if (nationHasDefaultColor) {
			marker.color = '#363636' // Dark gray
			marker.fillColor = hashCode(nation)
		}
		if (!nationHasDefaultColor) marker.color = '#bfff00' // Default green
		if (isRuin) marker.fillColor = marker.color = '#000000' // Black
		if (isNationless) marker.fillColor = marker.color = '#ff00ff' // Magenta
	}

	// Properties for alliances
	if (nationAlliances.length == 0) return marker
	marker.weight = 1.5
	marker.fillColor = nationAlliances[0].colours.fill
	marker.color = nationAlliances[0].colours.outline
	if (nationAlliances.length < 2) return marker
	marker.weight = 0.5

	return marker
}

function addChunksLayer(data) {
	const chunkLines = []
	for (let x = -33280; x <= 33088; x += 16) {
		chunkLines.push([
			{ "x": x, "z": -16640 },
			{ "x": x, "z": +16508 },
			{ "x": x, "z": -16640 }
		])
	}
	for (let z = -16640; z <= 16512; z += 16) {
		chunkLines.push([
			{ "x": -33280, "z": z },
			{ "x": +33088, "z": z },
			{ "x": -33280, "z": z }
		])
	}

	data[2] = {
		"hide": true,
		"name": "Chunks",
		"control": true,
		"id": "chunks",
		"markers": [{
			"weight": 0.33,
			"color": "#000000",
			"type": "polyline",
			"points": chunkLines
		}]
	}
	return data
}

async function lookupPlayer(player) {

	if (document.querySelector('#player-lookup') != null) document.querySelector('#player-lookup').remove()
	if (document.querySelector('#player-lookup-loading') != null) document.querySelector('#player-lookup-loading').remove()
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', htmlCode.playerLookupLoading)
	const loading = document.querySelector('#player-lookup-loading')

	const data = await fetchJSON('https://api.earthmc.net/v3/aurora/players?query=' + player)
	if (data == false) return sendAlert('Unexpected error occurred while looking up the player, please try later.')
	if (data == null) return sendAlert('Service is currently unavailable, please try later.')

	loading.remove()
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', htmlCode.playerLookup)
	const lookup = document.querySelector('#player-lookup')

	const isOnline = data[0].status.isOnline
	const balance = data[0].stats.balance
	const about = (!data[0].about || data[0].about == '/res set about [msg]') ? '' : `<br><i>${data[0].about}</i>`
	let rank = 'Townless'
	if (data[0].status.hasTown) rank = 'Resident'
	if (data[0].ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (data[0].status.isMayor) rank = 'Mayor'
	if (data[0].ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (data[0].status.isKing) rank = 'Leader'

	const playerAvatarURL = 'https://mc-heads.net/avatar/' + data[0].uuid.replaceAll('-', '')
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player)
		.replace('{about}', about)
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{rank}', rank)
		.replace('{balance}', balance)

	lookup.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}

async function fetchJSON(url) {
	const response = await fetch(url)
	if (response.status == 404) return false
	else if (response.ok) return response.json()
	else return null
}

async function getAlliances() {
	const alliances = await fetchJSON('https://emctoolkit.vercel.app/api/aurora/alliances')
	if (!alliances) {
		const cache = JSON.parse(localStorage.getItem('emcdynmapplus-alliances'))
		if (cache == null) {
			sendAlert('Service responsible for alliances is currently unavailable, please try later.')
			return []
		}
		sendAlert('Service responsible for alliances is currently unavailable - locally-saved alliance data has been loaded.')
		return cache
	}

	const finalArray = []
	for (const alliance of alliances) {
		let allianceType = alliance.type.toLowerCase() || 'mega'
		if (allianceType == 'sub') continue
		finalArray.push({
			name: alliance.fullName || alliance.allianceName,
			type: allianceType == 'mega' ? 'meganations' : 'alliances',
			nations: alliance.nations,
			colours: alliance.colours || { fill: '#000000', outline: '#000000' } // Black
		})
	}

	localStorage['emcdynmapplus-alliances'] = JSON.stringify(finalArray)
	return finalArray
}

// Replace the default fetch() with ours to intercept responses
window.fetch = async (...args) => {
    let [resource, config] = args
    let response = await originalFetch(resource, config)

	// Modify contents of markers.json and minecraft_overworld/settings.json
    if (response.url.includes('markers.json') || response.url.includes('minecraft_overworld/settings.json')) {

        const modifiedJson = await response.clone().json().then(data => {
			if (response.url.includes('markers.json')) data = main(data)
			if (response.url.includes('minecraft_overworld/settings.json')) data = modifySettings(data)
            return data
        })
        return new Response(JSON.stringify(modifiedJson))

    }

    return response
}