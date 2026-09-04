let url, bounds
const SCALE = 0.03125 // Number from L.map.options.scale
const isDarkened = localStorage['emcdynmapplus-darkened'] == 'true'

if (server == 'nova' || server == 'aurora') {
	url = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/refs/heads/main/src/assets/basemap-aurora.png'
	bounds = {down: -16508, left: -33280, up: 16640, right: 33080}
} else if (server == 'classic') {
	url = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/refs/heads/main/src/assets/basemap-classic.png'
	bounds = {down: 1023, left: -1535, up: -14335, right: 19455}
}

if (currentMapMode == 'archive' && server != 'nostra' && isNostra) hookLeaflet()

function hookLeaflet() {
    if (typeof(L) == 'undefined') return requestAnimationFrame(hookLeaflet)
    const originalMap = L.map
    L.map = function (...args) {
        const squaremap = originalMap.apply(this, args)
        L.imageOverlay(url, [
            [bounds.down * SCALE, bounds.left * SCALE],
            [bounds.up * SCALE, bounds.right * SCALE],
        ]).addTo(squaremap)
        waitForHTMLelement('.leaflet-image-layer').then((element) => {
            element.style.filter = isDarkened ? 'brightness(50%)' : ''
        })
		document.querySelector('.leaflet-tile-pane').remove()
        return squaremap
    }
}

function getArchiveURL() {
	let markersURL = 'https://map.earthmc.net/tiles/minecraft_overworld/markers.json'
	let date = chosenArchiveDate
	if (date < 20180708) {
		markersURL = 'https://map.earthmc.xyz/tiles/_markers_/marker_earth.json'
	} else if (date < 20220428) {
		markersURL = 'https://earthmc.net/map/tiles/_markers_/marker_earth.json'
	} else if (date < 20230212) {
		markersURL = `https://earthmc.net/map/${server}/tiles/_markers_/marker_earth.json`
	} else if (date < 20240623) {
		markersURL = `https://earthmc.net/map/${server}/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`
	} else if (date < 20240704) {
		date = 20240704 // Skip frequent changes that week
	}
	const archiveWebsite = `https://web.archive.org/web/${date}id_/`
	return archiveWebsite + markersURL
}

function convertOldMarkersStructure(markers) {
	return Object.entries(markers.areas).map(([key, value]) => {

		if (key.includes('_Shop')) return undefined // Remove shop areas
		const points = value.x.map((x, index) => ({ x, z: value.z[index] }))
		return {
			fillColor: value.fillcolor,
			color: value.color,
			popup: value.desc ?? `<div><b>${value.label}</b></div>`,
			weight: value.weight,
			opacity: value.opacity,
			type: 'polygon',
			points: points
		}

	}).filter(Boolean)
}

async function cacheArchiveSnapshot(data, timestamp) {
	try {
		const filename = `emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`
		const text = JSON.stringify({data: data, timestamp: timestamp})
		await saveToOPFS(filename, text)
	} catch (e) {
		sendMessage("Couldn't cache archive snapshot.")
		return null
	}
}

// Returns {data:.., timestamp:..}
async function getArchiveSnapshot() {
	try {
		const text = await getOPFS(`emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`)
		return JSON.parse(text)
	} catch (e) {
		return null
	}
}

async function getArchive(data) {

	let timestamp
	let cached = ''
	let cache = await getArchiveSnapshot()

	if (cache) {
		data[0] = cache.data
		timestamp = cache.timestamp
		cached = ', cached'
	} else {
		// Download snapshot
		const prompt = addElement(document.documentElement,
			htmlCode.promptBox.replace('{message}', 'Loading the snapshot, please wait...'), '#prompt-box')
		const markersURL = getArchiveURL()

		let archive = await fetchJSON(markersURL)

		if (archive.code == 429) {
			sendMessage('You have been rate-limited, try again in 30 seconds.')
			prompt.remove()
			return {data: data, ok: false}
		}
		if (!archive.ok || !archive.data) {
			sendMessage(`The snapshot can't be fetched right now, please try in a minute.`)
			prompt.remove()
			return {data: data, ok: false}
		}
		prompt.remove()

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			data[0].markers = convertOldMarkersStructure(archive.data.sets['towny.markerset'])
			timestamp = archive.data.timestamp
		} else if (chosenArchiveDate < 20240623) {
			data[0].markers = convertOldMarkersStructure(archive.data.sets['townyPlugin.markerset'])
			timestamp = archive.data.timestamp
		} else {
			data[0] = archive.data[0]
			timestamp = archive.data[0].timestamp
		}

		// Try to cache
		if (localStorage['emcdynmapplus-cache-archives'] == 'true') {
			const isCached = await cacheArchiveSnapshot(data[0], timestamp)
			if (isCached) cached = ', cached'
		}
	}

	const readableDate = new Date(parseInt(timestamp)).toLocaleDateString('en-ca')
	const actualArchiveDate = parseInt(readableDate.replaceAll('-', ''))

	document.querySelector('#current-map-mode-label').textContent += ` (${readableDate}${cached})`

	if (actualArchiveDate != chosenArchiveDate) {
		sendMessage(`The closest archive to your query comes from ${readableDate}.`)
	}

	return {data: data, ok: true}
}

// Modify town descriptions for archives
function modifyOldDescription(marker) {
	// Gather some information
	const dummy = document.createElement('div')
	dummy.innerHTML = marker.popup
	let membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
	let residents = dummy.querySelectorAll('span')[2].textContent
	const residentNum = residents?.split(', ')?.length || 0
	const isCapital = marker.popup.match(/capital: true/) != null
	const area = getArea(marker.points)

	// Modify description
	if (isCapital) marker.popup = marker.popup.replace('120%">', '120%">★ ')
	if (chosenArchiveDate < 20220906) {
		marker.popup = marker.popup.replace(/">hasUpkeep:.+?(?<=<br \/>)/, '; white-space:pre">')
	}
	else marker.popup = marker.popup.replace('">pvp:', '; white-space:pre">pvp:')

	marker.popup = marker.popup.replace('Flags<br />', '<br>Flags<br>')
		.replace('>pvp:', '>PVP allowed:')
		.replace('>mobs:', '>Mob spawning:')
		.replace('>public:', '>Public status:')
		.replace('>explosion:', '>Explosions:&#9;')
		.replace('>fire:', '>Fire spread:&#9;')
		.replace(/<br \/>capital:.*<\/span>/, '</span>')
		.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
		.replaceAll('false<', '&#9;<span style="color:red">No</span><')
		.replace(`${membersTitle} <span`, `${membersTitle} <b>[${residentNum}]</b> <span`)
	if (area > 0) {
		marker.popup = marker.popup
		.replace(`</span><br /> ${membersTitle}`, `</span><br>Size<span style="font-weight:bold"> ${area} </span><br> ${membersTitle}`)
	}
	// Scrollable resident list
	if (residentNum > 50) {
		marker.popup = marker.popup
			.replace(`<b>[${residentNum}]</b> <span style="font-weight:bold">`,
				`<b>[${residentNum}]</b> <div id="scrollable-list"><span style="font-weight:bold">`)
			.replace('<br>Flags', '</div><br>Flags')
	}

	return marker
}