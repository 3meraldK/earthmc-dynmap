const { fetch: originalFetch } = window
const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
	partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayer(\'{player}\')">{player}</span>',
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
	promptBox: '<div id="prompt-box"><p id="message">{message}</p></div>',
	messageBox: '<div id="message-box"><p id="message">{message}</p><br><button id="message-close">OK</button></div>'
}

const server = localStorage['emcdynmapplus-terra-nova-archive'] == 'true' ? 'nova' : 'aurora'
const alliancesURL = 'https://emcstats.bot.nu/aurora/alliances'
const apiURL = 'https://api.earthmc.net/v4/aurora'
const proxyURL = 'https://proxy.killcors.com/?url='
const isNostra = location.href.includes('nostra')
const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
const chosenArchiveDate = parseInt(localStorage['emcdynmapplus-archive-date'])

let alliances = null
if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)

// Clickable player nameplates
waitForHTMLelement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) lookupPlayer(username, false)
	})
})

function sendMessage(message) {
	if (document.querySelector('#message-box') != null) document.querySelector('#message-box').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.messageBox.replace('{message}', message))
	document.querySelector('#message-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

function modifySettings(data) {
	data['player_tracker'].nameplates['show_heads'] = true
	data['player_tracker'].nameplates['heads_url'] = 'https://mc-heads.net/avatar/{uuid}/16'
	data.zoom.def = 0
	data.spawn = { x: 2000, z: -10000 } // Set camera on Europe
	if (currentMapMode == 'archive') data['player_tracker'].enabled = false
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

	// Data has imprecise coordinates; round vertices to 16
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n
		area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
		area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
	}

	return (Math.abs(area) / 2) / (16 * 16)
}

// By James Halliday (substack)
function pointInPolygon(vertex, polygon) {
	let x = vertex.x, z = vertex.z
	let n = polygon.length
	let inside = false
	for (let i = 0, j = n - 1; i < n; j = i++ ) {
		let xi = polygon[i].x
		let zi = polygon[i].z
		let xj = polygon[j].x
		let zj = polygon[j].z

		let intersect = ((zi > z) != (zj > z))
			&& (x < (xj - xi) * (z - zi) / (zj - zi) + xi)
		if (intersect) inside = !inside
	}
	return inside
}

// Modify town descriptions for archives
function modifyOldDescription(marker) {
	// Gather some information
	let membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
	let residents = marker.popup.match(`${membersTitle} <span style="font-weight:bold">(.*)<\/span><br \/>Flags`)?.[1]
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

function modifyDescription(marker) {
	// Gather some information
	const town = marker.tooltip.match(/<b>(.*)<\/b>/)[1]
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	let councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1].split(', ')
	councillors = councillors.filter(councillor => councillor != 'None')
	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents.split(', ').length
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null

	// Town's area
	let area = 0
	const iteratedRegions = []
	if (marker.type == 'polygon') {
		for (const regionVertices of marker.points[0]) {

			// Exclude non-affiliated regions entirely inside town
			if (iteratedRegions.length > 0) {
				let isInsidePolygon = false
				for (const vertex of regionVertices) {
					for (const lastPolygon of iteratedRegions) {
						if (pointInPolygon(vertex, lastPolygon)) isInsidePolygon = true
					}
				}
				if (isInsidePolygon) area -= getArea(regionVertices)
				else area += getArea(regionVertices)
			}
			else area += getArea(regionVertices)
			iteratedRegions.push(regionVertices)

		}
	}

	// Create clickable resident lists
	const residentList = (currentMapMode == 'archive') ? residents :
		residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorList = (currentMapMode == 'archive') ? councillors :
		councillors.map(councillor => htmlCode.residentClickable.replaceAll('{player}', councillor)).join(', ')

	// Modify description
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, htmlCode.scrollableResidentList.replace('{list}', residentList))
	} else {
		marker.popup = marker.popup.replace(residents + '\n', htmlCode.residentList.replace('{list}', residentList) + '\n')
	}

	// Names wrapped in angle brackets
	const names = {
		town: town.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
		nation: nation?.replaceAll('<', '&lt;').replaceAll('>', '&gt;') ?? nation
	}

	marker.popup = marker.popup
		.replace(town, names.town)
		.replace(nation, names.nation)
		.replace('</details>\n   \t<br>', '</details>')
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`)
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<i></i> \n    <br>\n', '')
		.replace('\n    <i>', '\n    <i style="overflow-wrap: break-word">')
		.replace('Councillors: <b>None</b>\n\t<br>', '')
		.replace('Size: <b>0 chunks</b><br/>', '')
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>')
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>')
	if (currentMapMode != 'archive') {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`)
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`)
	}
	if (isCapital) marker.popup = marker.popup
		.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">★ ')

	// Modify tooltip
	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')
		.replace('\n    <i>', '\n    <i id="clamped-board">')
		.replace(town, names.town)
		.replace(nation, names.nation)

	// 'Part of' label
	if (currentMapMode == 'archive' || currentMapMode == 'default') return marker
	const nationAlliances = getNationAlliances(nation)
	if (nationAlliances.length > 0) {
		const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
		const partOfLabel = htmlCode.partOfLabel.replace('{allianceList}', allianceList)
		marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
	}

	return marker
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
	const nationHasDefaultColor = (marker.color == '#3fb4ff' && marker.fillColor == '#3fb4ff') // Default blue

	// Universal properties for the map modes
	if (currentMapMode == 'alliances') {
		marker.fillColor = marker.color = '#000000' // Black
		marker.weight = 0.5
	} else {
		if (nationHasDefaultColor) {
			marker.color = '#363636' // Dark gray
			marker.fillColor = hashCode(nation) // Random color
		}
		else marker.color = '#89c500' // Default green
	}
	if (isRuin) return marker.fillColor = marker.color = '#000000'

	// Properties for alliances
	const nationAlliances = getNationAlliances(nation)
	if (nationAlliances.length == 0) return marker
	marker.weight = 1.5
	marker.fillColor = nationAlliances[0].colours.fill
	marker.color = nationAlliances[0].colours.outline
	if (nationAlliances.length > 1) marker.weight = 0.5

	return marker
}

function addChunksLayer(data) {
	const chunkLines = []
	for (let x = -33280; x <= 33088; x += 16) {
		chunkLines.push([
			{ x: x, z: -16640 },
			{ x: x, z: +16512 },
			{ x: x, z: -16640 }
		])
	}
	for (let z = -16640; z <= 16512; z += 16) {
		chunkLines.push([
			{ x: -33280, z: z },
			{ x: +33088, z: z },
			{ x: -33280, z: z }
		])
	}

	data.push({
		hide: true,
		name: 'Chunks',
		control: true,
		id: 'chunks',
		markers: [{
			weight: 0.33,
			color: '#000000',
			type: 'polyline',
			points: chunkLines
		}]
	})
	return data
}

function waitForHTMLelement(selector) {
	return new Promise(resolve => {
		if (document.querySelector(selector)) {
			return resolve(document.querySelector(selector))
		}

		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) {
				resolve(document.querySelector(selector))
				observer.disconnect()
			}
		})
		observer.observe(document.body, { childList: true, subtree: true })
	})
}

function addElement(parent, element, returnWhat, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(returnWhat) : parent.querySelectorAll(returnWhat)
}

async function main(data) {

	if (currentMapMode == 'archive') {
		data = await getArchive(data)
	}

	if (!isNostra) data = addChunksLayer(data)
	data = await addCountryLayer(data)

	if (!data?.[0]?.markers?.length) {
		sendMessage('Unexpected error occurred while loading the map, maybe EarthMC is down? Try again later.')
		return data
	}

	for (let marker of data[0].markers) {
		if (marker.type != 'polygon' && marker.type != 'icon') continue

		marker = (currentMapMode != 'archive' || chosenArchiveDate >= 20240701)
		? modifyDescription(marker) : modifyOldDescription(marker)

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

function millerProjection(z) {
	// -16640 and 16508 are vertical bounds of old map (Plate Carree projection)
	// Assume old map covers every latitude
	// Convert old (Aurora) map's Z-coord to latitude
	const latDeg = (z - -16640) * (90 - -90) / (16508 - -16640) + -90
	const latRad = latDeg * (Math.PI / 180)

	// 2.304 is a magic number from 5/4 * Math.asinh(Math.tan(4/5 * (90 * (Math.PI / 180))))
	// 16574 is a mean average of old map vertical bounds
	const multiplier = 16574 / 2.3034125433763912

	// project from Plate Carree to Miller Cylindrical
	// Adjust projection of north hemisphere
	const northHemisphereFactor = 0.994
	let millerOldZ = 5/4 * Math.asinh(Math.tan(4/5 * latRad)) * multiplier
	if (millerOldZ < 0) millerOldZ *= northHemisphereFactor

	// 33148 is height of old map
	// 94704 is estimated height of new (Nostra) map if it wasn't cropped
	const scale = 94704 / 33148

	return millerOldZ * scale
}

async function addCountryLayer(data) {

	// Download & cache
	if (!localStorage['emcdynmapplus-borders']) {
		const prompt = addElement(document.body, htmlCode.promptBox.replace('{message}', 'Downloading country borders...'), '#prompt-box')
		const markersURL = 'https://web.archive.org/web/2024id_/https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json'
		const fetch = await fetchJSON(proxyURL + markersURL)
		prompt.remove()
		if (!fetch.ok || !fetch.data) {
			sendMessage('Could not download optional country borders layer, you could try again later.')
			return data
		}
		localStorage['emcdynmapplus-borders'] = JSON.stringify(fetch.data.sets['borders.Country Borders'].lines)
	}

	try {
		// Assemble
		const points = []
		const countries = JSON.parse(localStorage['emcdynmapplus-borders'])
		for (const line of Object.values(countries)) {
			const linePoints = []
			for (const x in line.x) {
				if (isNaN(parseInt(line.x[x]))) continue

				// Hand-picked constants
				// 1.94 is how many times Nostra map horizontally bigger is than Aurora's
				// 382.5 is to how much to move layer to right by
				// 8175 ... same as above but move down
				// 1.0015 is a horizontal adjustment for Aurora map
				let newCoords
				if (isNostra) {
					newCoords = {
						x: line.x[x] * 1.94133 + 382.5,
						z: millerProjection(line.z[x]) + 8175
					}
				} else {
					newCoords = {
						x: line.x[x] * 1.0015,
						z: line.z[x]
					}
				}
				linePoints.push(newCoords)
			}
			points.push(linePoints)
		}

		// Create layer
		data.push({
			hide: true,
			name: 'Country Borders',
			control: true,
			id: 'borders',
			order: 999,
			markers: [{
				weight: 1,
				color: '#ffffff',
				type: 'polyline',
				points: points
			}]
		})
		return data
	} catch (error) {
		sendMessage(`Could not set up a layer of country borders. You may need to clear this website's data.`)
		return data
	}
}

async function lookupPlayer(player, showOnlineStatus = true) {

	if (document.querySelector('#player-lookup') != null) document.querySelector('#player-lookup').remove()
	if (document.querySelector('#player-lookup-loading') != null) document.querySelector('#player-lookup-loading').remove()
	const loading = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookupLoading, '#player-lookup-loading')

	const query = { query: [player] }
	const data = await fetchJSON(apiURL + '/players', { method: 'POST', body: JSON.stringify(query) })
	if (!data.ok) {
		document.querySelector('#player-lookup-loading').remove()
		return sendMessage('Service is currently unavailable, please try later.')
	}
	if (!data.data[0]) {
		document.querySelector('#player-lookup-loading').remove()
		return sendMessage(`This player opted out of being looked up.`)
	}

	loading.remove()
	const lookup = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookup, '#player-lookup')

	// Populate with placeholders
	lookup.insertAdjacentHTML('beforeend', '{show-online-status}<br>')
	lookup.insertAdjacentHTML('beforeend', '<img id="player-lookup-avatar"/>')
	lookup.insertAdjacentHTML('beforeend', '<center><b id="player-lookup-name">{player}</b>{about}</center>')
	lookup.insertAdjacentHTML('beforeend', '<hr>{town}{nation}')
	lookup.insertAdjacentHTML('beforeend', 'Rank: <b>{rank}</b><br>')
	lookup.insertAdjacentHTML('beforeend', 'Balance: <b>{balance} gold</b><br>')
	lookup.insertAdjacentHTML('beforeend', '{last-online}')
	lookup.insertAdjacentHTML('beforeend', '<span class="close-container">×</span>')

	// Gather data
	const isOnline = data.data[0].status.isOnline
	const balance = data.data[0].stats.balance
	const town = data.data[0].town.name
	const nation = data.data[0].nation.name
	const lastOnline = new Date(data.data[0].timestamps.lastOnline).toLocaleDateString('fr')
	let onlineStatus = '<span id="player-lookup-online" style="color: {online-color}">{online}</span>'
	const about = (!data.data[0].about || data.data[0].about == '/res set about [msg]') ? '' : `<br><i>${data.data[0].about}</i>`
	let rank = 'Townless'
	if (data.data[0].status.hasTown) rank = 'Resident'
	if (data.data[0].ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (data.data[0].status.isMayor) rank = 'Mayor'
	if (data.data[0].ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (data.data[0].status.isKing) rank = 'Leader'

	// Modify HTML
	const playerAvatarURL = 'https://mc-heads.net/avatar/' + data.data[0].uuid.replaceAll('-', '')
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player)
		.replace('{about}', about)
		.replace('{show-online-status}', showOnlineStatus ? onlineStatus : '')
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{town}', town ? `Town: <b>${town}</b><br>` : '')
		.replace('{nation}', nation ? `Nation: <b>${nation}</b><br>` : '')
		.replace('{rank}', rank)
		.replace('{balance}', balance)
		.replace('{last-online}', !isOnline ? `Last online: <b>${lastOnline}</b><br>` : '')
	lookup.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })

	// Enable scrolling the about section
	lookup.querySelector('center > i')?.addEventListener('wheel', (event) => {event.stopImmediatePropagation()})
}

async function fetchJSON(url, options = null) {
	try {
		const response = await fetch(url, options)
		let data = null
		try { data = await response.json() }
		finally { return {ok: response.ok, code: response.status, data: data} }
	} catch {
		return {ok: false, code: null, data: null}
	}
}

async function getAlliances() {
	const response = await fetchJSON(alliancesURL)
	if (!response.ok || !response.data) {
		try {
			const cache = JSON.parse(localStorage['emcdynmapplus-alliances'])
			if (response.code != 429) { // 429 = too many requests, ignore
				sendMessage('Service responsible for loading alliances is currently unavailable, but locally-cached data will be used.')
			}
			return cache
		} catch (e) {
			sendMessage('Service responsible for loading alliances will be available later.')
			return []
		}
	}
	const alliances = response.data

	function getAllianceByName(name) {
		return alliances.find(it => it.identifier == name)
	}

	function findRoot(alliance, isFirstSearch = true) {
		if (!alliance.parentAlliance) return (isFirstSearch) ? null : alliance
		return findRoot(getAllianceByName(alliance.parentAlliance), false)
	}

	const nationList = new Map()
	const finalArray = []
	for (const alliance of alliances) {
		const rootName = findRoot(alliance)?.identifier || alliance.identifier
		nationList.set(rootName, [...nationList.get(rootName) || [], alliance.ownNations].flat())
	}
	for (const allianceMap of nationList) {
		const alliance = getAllianceByName(allianceMap[0])
		const allianceType = alliance?.type?.toLowerCase() || 'mega'
		const fill = '#' + alliance?.optional?.colours?.fill || '#000000'
		const outline = '#' + alliance?.optional?.colours?.outline || '#000000'
		finalArray.push({
			name: alliance?.label || allianceMap[0],
			type: allianceType == 'mega' ? 'meganations' : 'alliances',
			nations: allianceMap[1],
			colours: { fill: fill, outline: outline }
		})
	}

	localStorage['emcdynmapplus-alliances'] = JSON.stringify(finalArray)
	return finalArray
}

function getArchiveURL() {
	let markersURL = 'https://map.earthmc.net/tiles/minecraft_overworld/markers.json'
	let date = chosenArchiveDate
	if (date < 20220428) {
		markersURL = 'https://earthmc.net/map/tiles/_markers_/marker_earth.json'
	} else if (date < 20230212) {
		markersURL = `https://earthmc.net/map/${server}/tiles/_markers_/marker_earth.json`
	} else if (date < 20240623) {
		markersURL = `https://earthmc.net/map/${server}/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`
	} else if (date < 20240704) {
		date = 20240704 // skip frequent changes that week
	}
	const archiveWebsite = `https://web.archive.org/web/${date}id_/`
	return archiveWebsite + markersURL
}

async function cacheArchiveSnapshot(data, timestamp) {
	try {
		const fileSystem = await navigator.storage.getDirectory()
		let fileHandle
		try { fileHandle = await fileSystem.getFileHandle(`emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`) }
		catch (e) {fileHandle = await fileSystem.getFileHandle(`emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`, {create: true}) }
		const writable = await fileHandle.createWritable()
		await writable.write(JSON.stringify({data: data, timestamp: timestamp}))
		await writable.close()
		return true
	} catch (e) {
		sendMessage("Couldn't cache archive snapshot.")
		return null
	}
}

// Returns {data:.., timestamp:..}
async function getArchiveSnapshot() {
	try {
		const fileSystem = await navigator.storage.getDirectory()
		let fileHandle = await fileSystem.getFileHandle(`emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`)
		const file = await fileHandle.getFile()
		const text = await file.text()
		return JSON.parse(text)
	} catch (e) {
		return null
	}
}

async function getArchive(data) {

	let timestamp
	let cached = ''
	let cache = await getArchiveSnapshot()

	// Create town layer if there isn't
	if (!data.some(layer => layer.name == 'Territory')) {
		data.unshift({
			hide: true,
			name: 'Territory',
			control: true,
			id: 'towny',
			markers: null
		})
	}

	if (cache) {
		data[0] = cache.data
		timestamp = cache.timestamp
		cached = ', cached'
	} else {
		// Download snapshot
		const prompt = addElement(document.body, htmlCode.promptBox.replace('{message}', 'Loading the snapshot, please wait...'), '#prompt-box')
		markersURL = getArchiveURL()
		let archive = await fetchJSON(proxyURL + markersURL)
		if (!archive.ok || !archive.data) return sendMessage('Archive service is currently unavailable, please try later.')
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

	readableDate = new Date(parseInt(timestamp)).toLocaleDateString('en-ca')
	actualArchiveDate = parseInt(readableDate.replaceAll('-', ''))

	document.querySelector('#current-map-mode-label').textContent += ` (${readableDate}${cached})`

	if (actualArchiveDate != chosenArchiveDate) {
		sendMessage(`The closest archive to your query comes from ${readableDate}.`)
	}

	// Star icons on Nostra map don't display
	if (isNostra) {
		data[0].markers.forEach(marker => {
			if (marker.type == 'icon') marker.type = null
		})
	}

	return data
}

// Replace the default fetch() with ours to intercept responses
let preventMapUpdate = false
window.fetch = async (...args) => {
	const response = await originalFetch(...args)

	const playerList = document.querySelector('fieldset#players')
	if (response.url.includes('players.json') && playerList) {
		const scroll = playerList.scrollTop
		setTimeout(() => playerList.scrollTop = scroll, 1)
	}

	if (response.url.includes('web.archive.org')) return response

	if (response.url.includes('markers.json') || response.url.includes('minecraft_overworld/settings.json')) {

		const modifiedJson = await response.clone().json().then(data => {

			if (response.url.includes('markers.json')) {
				if (preventMapUpdate == false) {
					preventMapUpdate = true
					return main(data)
				}
				else return null
			}

			if (response.url.includes('minecraft_overworld/settings.json')) return modifySettings(data)
		})
		return new Response(JSON.stringify(modifiedJson))

	}

	return response
}