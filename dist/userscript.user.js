// ==UserScript==
// @name         EarthMC Dynmap+
// @version      26.3
// @description  Enrich the EarthMC map exploration's experience
// @author       3meraldK
// @match        https://map.earthmc.net/*
// @match        https://aurora.earthmc.net/*
// @iconURL      https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/src/extension/icon.png
// @grant        GM.xmlHttpRequest
// @connect      archive.org
// @connect      earthmc.net
// @connect      githubusercontent.com
// @connect      emcstats.bot.nu
// @run-at       document-start
// @updateURL    https://github.com/3meraldK/earthmc-dynmap/raw/refs/heads/main/dist/userscript.user.js
// @downloadURL  https://github.com/3meraldK/earthmc-dynmap/raw/refs/heads/main/dist/userscript.user.js
// ==/UserScript==

/* variables.js - for variables that occur in almost every part of code */

const isExtension = typeof(unsafeWindow) == 'undefined' // unsafeWindow is only in userscripts
const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
const isNostra = !location.href.includes('aurora')
const apiURL = 'https://api.earthmc.net/v4'
let chosenArchiveDate = parseInt(localStorage['emcdynmapplus-archive-date'])

const { fetch: originalFetch } = window
// Make this function work in userscript
if (!isExtension) unsafeWindow.lookupPlayerFunc = lookupPlayer
const alliancesURLworld = isNostra? 'nostra' : 'aurora'
const alliancesURL = `https://emcstats.bot.nu/${alliancesURLworld}/alliances`
const serverMap = {
	'Classic': 'classic',
	'Terra Nova': 'nova',
	'Terra Aurora': 'aurora',
	'Terra Nostra': 'nostra'
}
const server = serverMap[localStorage['emcdynmapplus-archive-mode-world']]

// alliance.js
let alliances = null
if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)

const css = `.sidebar-option {
    width: 150px;
    display: flex;
}

.sidebar-input {
    width: 100%;
}

.sidebar-button {
    min-width: 75px;
}

#current-map-mode-label {
    font-size: larger;
    padding: 5px;
    box-sizing: border-box;
}

#emcdynmapplus-sidebar {
    padding: 3px;
}

#locate-menu {
    padding-bottom: 5px;
    display: block;
}

#locate-button, #options-button, #options-menu {
    width: 150px;
}

.option {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
}

#archive-input {
    width: 70px;
}

#message-box, #prompt-box {
    position: absolute;
    width: 300px;
    font-family: 'Arial';
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    background-color: white;
    color: black;
    font-size: large;
    box-sizing: border-box;
    padding: 8px;
    text-align: center;
    border-radius: 10px;
}

#message {
    margin-block: 0;
    text-align: justify;
}

.left-container {
    width: 150px;
    text-align: justify;
    font-size: larger;
    padding: 5px;
    box-sizing: border-box;
}

.close-container {
    position: relative;
    left: 120px;
    cursor: pointer;
    font: 16px/24px Tahoma, Verdana, sans-serif;
}

/* Update notification - for userscript */

#update-download-link {
    font-weight: bold;
    text-decoration: none;
}

/*fieldset#players {
    z-index: 999;
    position: fixed;
    background-color: rgba(0,0,0,.5);
    color: white;
    display: none;
    overflow-y: scroll;
    height: stretch;
    right: 0;
    margin: 10px 0 10px 0;
    scrollbar-width: thin;
    scrollbar-color: #aaa rgba(0,0,0,0.1);
}

fieldset#players > legend {
    font-weight: bold;
}

fieldset#players > a {
    color: white;
    padding: 5px 0;
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
}

fieldset#players > a:hover {
    background-color: rgba(127, 127, 125, 0.5);
    cursor: pointer;
}

.following {
    background-color: rgba(0, 255, 0, 0.5);
}*/

#followingWarning {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 99999;
    color: white;
    font-family: Arial;
}

#player-lookup {
    text-align: unset;
    position: absolute;
    top: 74px;
    left: 170px;
}

#player-lookup-online {
    position: absolute;
    top: 5px;
    left: 5px;
}

#player-lookup-avatar {
    margin: 10px auto auto auto;
    display: block;
    width: 32px;
    box-shadow: 0 0 10px 1px black;
}

#player-lookup-name {
    line-height: 40px;
}

#player-lookup > center > i {
    overflow-y: auto;
    scrollbar-width: thin;
    max-height: 100px;
    display: block;
}

.leaflet-tooltip {
    pointer-events: unset !important;
}

.leaflet-tooltip:hover {
    background-color: rgba(127, 127, 127, 0.5);
    cursor: pointer;
}

#player-lookup-loading {
    width: auto;
}

#scrollable-list {
    overflow: auto;
    max-height: 200px;
}

#clamped-board {
    max-width: 400px;
    text-overflow: ellipsis;
    overflow: hidden;
    display: inline-block;
}

.resident-list {
    white-space: pre-wrap;
}

#part-of-label {
    font-size: 85%;
}

.resident-clickable:hover {
    background-color: rgba(127, 127, 125, 0.5);
    cursor: pointer;
}

`

async function getAlliances() {
	const response = await fetchJSON(alliancesURL)
	if (!response.ok || !response.data) {
		try {
			const cache = JSON.parse(localStorage['emcdynmapplus-alliances'])
			if (response.code != 429) { // 429 = too many requests, ignore
				sendMessage('The live alliance registry is currently inaccessible - displaying the last version your browser saved.')
			}
			return cache
		} catch (e) {
			sendMessage('The live alliance registry is currently inaccessible, try again later.')
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

function getNationAlliances(nation) {
	const nationAlliances = []
	if (alliances == null) return nationAlliances
	for (const alliance of alliances) {
		if (!alliance.nations.includes(nation)) continue
		if (alliance.type != currentMapMode) continue
		if (alliance.colours.fill == '#undefined' || alliance.colours.outline == '#undefined') {
			alliance.colours.fill = alliance.colours.outline = '#3fb4ff'
		}
		nationAlliances.push({name: alliance.name, colours: alliance.colours})
	}
	return nationAlliances
}

// in variables.js
// let alliances = null
// if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)

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

function checkForUpdate() {
	const version = {
		cached: localStorage['emcdynmapplus-version'],
		latest: isExtension ? localStorage['emcdynmapplus-manifest-version'] : GM_info.script.version
	}
	if (!version.cached) return localStorage['emcdynmapplus-version'] = version.latest
	if (version.cached != version.latest) {
		const changelogURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
		sendMessage(`The extension has been automatically updated from ${version.cached} to ${version.latest}.
			Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.`)
	}
	localStorage['emcdynmapplus-version'] = version.latest
}

async function fetchJSON(url, options = null) {
	try {
		const response = await corsFetch(url, options)
		let data = null
		try {
			data = isExtension ? await response.json() : await JSON.parse(response.response)
		} finally {
			const isOK = isExtension ? response.ok : `${response.status}`.startsWith('2')
			return {ok: isOK, code: response.status, data: data}
		}
	} catch {
		return {ok: false, code: null, data: null}
	}
}

const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
	partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	// residentClickable: Different onclick functions in userscript and extension
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayerFunc(\'{player}\')">{player}</span>',
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
	promptBox: '<div id="prompt-box"><p id="message">{message}</p></div>',
	buttons: {
		locate: '<button class="sidebar-button" id="locate-button">{locate-text}</button>',
		searchArchive: '<button class="sidebar-button" id="archive-button">Search archive</button>',
		options: '<button class="sidebar-button" id="options-button">Options</button>',
		switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>'
		// deprecated: togglePlayerList: '<button class="sidebar-input" id="toggle-player-list">Toggle player list</button>'
	},
	options: {
		menu: '<div id="options-menu"></div>',
		option: '<div class="option"></div>',
		label: '<label for="{option}">{optionName}</label>',
		checkbox: '<input id="{option}" type="checkbox" name="{option}">',
		archiveWorldMode: `<select id="archive-mode-world"><option value="" selected disabled hidden>{current}</option></select>`,
		clearStorage: '<button class="sidebar-input" id="clear-storage" style="margin-top: 5px; display: block">Refresh site data</button>'
	},
	sidebar: '<div class="leaflet-control-layers leaflet-control" id="emcdynmapplus-sidebar"></div>',
	sidebarOption: '<div class="sidebar-option"></div>',
	locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
	locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
	archiveInput: '<input class="sidebar-input" id="archive-input" type="date">',
	currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
	followingPlayer: '<h1 id="followingWarning">Click on map to unfollow player</h1>',
    messageBox: '<div id="message-box"><p id="message">{message}</p><br><button id="message-close">OK</button></div>',
	// Exclusively for userscript, deprecated
	// updateNotification: '<div class="leaflet-control-layers leaflet-control left-container"
	// 		id="update-notification">{text}<br><span class="close-container">×</span></div>'
}

async function addBordersLayer(data) {
	for (const type of ['country', 'province']) {
		// Download & cache
		if (!await getOPFS('emcdynmapplus-borders-' + type)) {
			const prompt = addElement(document.documentElement,
				htmlCode.promptBox.replace('{message}', `Downloading ${type} borders...`), '#prompt-box')
			const url = `https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/refs/heads/main/src/assets/borders-${type}.json.gz`
			const layer = await fetchLayer(url)

			prompt.remove()
			if (!layer) {
				sendMessage(`Could not download ${type} borders layer, try again later.`)
				continue
			}
			await saveToOPFS('emcdynmapplus-borders-' + type, JSON.stringify(layer))
		}

		// Add layer
		try {
			const layer = JSON.parse(await getOPFS('emcdynmapplus-borders-' + type))
			const archiveWorld = localStorage['emcdynmapplus-archive-mode-world']
			if (currentMapMode != 'archive' || archiveWorld == 'Terra Nostra') data.push(layer)
			continue
		} catch (error) {
			sendMessage(`Could not set up a layer of ${type} borders. You may need to clear this website's data.`)
			continue
		}
	}
	return data
}

async function fetchLayer(url) {
	try {
		let gzip = null
		if (!isExtension) {
			// userscript fetch
			const options = { url: url, method: 'GET', responseType: 'arraybuffer' }
			const response = await GM.xmlHttpRequest(options)
			gzip = response.response
		} else {
			// extension fetch
			const req = await corsFetch(url)
			gzip = await req.arrayBuffer()
		}
		const stream = new Response(gzip).body.pipeThrough(new DecompressionStream('gzip'))
		const text = await new Response(stream).text()
		const layer = JSON.parse(text)
		return layer
	} catch (error) {
		return null
	}
}

// deprecated:
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

async function getTownSpawn(searchedTownName) {
	if (currentMapMode == 'archive' || !isNostra) {
		if (!isNostra && currentMapMode != 'archive') chosenArchiveDate = 20260412
		const markersURL = getArchiveURL()

		let markers = await fetchJSON(markersURL)

		if (!markers.ok) return null
		if (!markers.data) return false

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			markers = convertOldMarkersStructure(markers.data.sets['towny.markerset'])
		} else if (chosenArchiveDate < 20240623) {
			markers = convertOldMarkersStructure(markers.data.sets['townyPlugin.markerset'])
		} else {
			markers = markers.data[0].markers
		}

		let target = null
		const dummy = document.createElement('div')
		for (const marker of markers) {
			dummy.innerHTML = marker.popup
			const townName = dummy.textContent.replaceAll('\n', '').trim().split(' ')[0].toLowerCase()
			if (townName == searchedTownName) target = marker
		}
		if (!target) return false
		let points = target.points.flat(Infinity)
		let coords = { x: points[0].x, z: points[0].z }
		return coords
	}
	const query = { query: [searchedTownName], template: { coordinates: true } }
	const data = await fetchJSON(apiURL + '/towns', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return null
	try { return { x: Math.round(data.data[0].coordinates.spawn.x), z: Math.round(data.data[0].coordinates.spawn.z) } }
	catch { return false }
}

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const coords = await getTownSpawn(town)
	if (coords == false) return sendMessage('Searched town has not been found.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.search = `zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	if (currentMapMode == 'archive' || !isNostra) {
		if (!isNostra && currentMapMode != 'archive') chosenArchiveDate = 20260412
		const markersURL = getArchiveURL()

		let markers = await fetchJSON(markersURL)
		let capitals
		let popupProperty = chosenArchiveDate < 20240623 ? 'desc' : 'popup'

		if (!markers.ok) return null
		if (!markers.data) return false

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			capitals = Object.values(markers.data.sets['towny.markerset'].markers)
		} else if (chosenArchiveDate < 20240623) {
			capitals = Object.values(markers.data.sets['townyPlugin.markerset'].markers)
		} else {
			capitals = markers.data[0].markers.filter(marker => marker.tooltip_anchor)
		}

		let target = capitals.find(marker => marker[popupProperty].toLowerCase().includes(nation + '</a>)')
			|| marker[popupProperty].toLowerCase().includes(nation + ')'))
		if (!target) return sendMessage('Searched nation has not been found.')
		const coords = (chosenArchiveDate < 20240623) ? {x: target.x, z: target.z } : {x: target.point.x, z: target.point.z }
		location.search = `zoom=4&x=${coords.x}&z=${coords.z}`
	}

	const query = { query: [nation], template: { capital: true } }
	const data = await fetchJSON(apiURL + '/nations', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')
	if (!data.data) return sendMessage('Searched nation has not been found.')

	let capital
	try { capital = data.data[0].capital.name.toLowerCase() }
	catch { return sendMessage('Searched nation has not been found.') }
	const coords = await getTownSpawn(capital)
	if (coords == false) return sendMessage('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.search = `zoom=4&x=${coords.x}&z=${coords.z}`
}

// https://codepen.io/seansean/pen/QxjqVp
function getStringBetween(str, start, end) {
    try { return str.match(new RegExp(start + '(.*)' + end))[1] }
	catch { return null }
}

async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	if (currentMapMode == 'archive' || !isNostra) {
		if (!isNostra && currentMapMode != 'archive') chosenArchiveDate = 20260412
		const markersURL = getArchiveURL()

		let markers = await fetchJSON(markersURL)

		if (!markers.ok) return null
		if (!markers.data) return false

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			markers = convertOldMarkersStructure(markers.data.sets['towny.markerset'])
		} else if (chosenArchiveDate < 20240623) {
			markers = convertOldMarkersStructure(markers.data.sets['townyPlugin.markerset'])
		} else {
			markers = markers.data[0].markers
		}

		let target = null
		const dummy = document.createElement('div')
		for (const marker of markers) {
			dummy.innerHTML = marker.popup
			const townName = dummy.textContent.replaceAll('\n', '').trim().split(' ')[0]
			if (chosenArchiveDate < 20240623) {
				const membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
				resList = getStringBetween(dummy.textContent, membersTitle + ' ', 'Flags').toLowerCase()
			} else {
				dummy.querySelector('summary').remove()
				resList = dummy.querySelector('details').textContent.replaceAll(/\t|\n/g, '').trim().toLowerCase()
			}
			if (resList.includes(resident)) target = townName
		}

		if (!target) return false
		return locateTown(target)
	}

	const query = { query: [resident], template: { town: true } }
	const data = await fetchJSON(apiURL + '/players', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')

	try {
		const town = data.data[0].town.name.toLowerCase()
		const coords = await getTownSpawn(town)
		if (coords == false) return sendMessage('Unexpected error occurred while searching for resident, please try later.')
		if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
		location.search = `zoom=4&x=${coords.x}&z=${coords.z}`
	} catch {
		return sendMessage(`The searched resident is townless or they opted out of being looked up.`)
	}
}

function locate(selectValue, inputValue) {
	switch (selectValue) {
		case 'Town': locateTown(inputValue); break
		case 'Nation': locateNation(inputValue); break
		case 'Resident': locateResident(inputValue); break
	}
}

function colorTowns(marker) {
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isRuin = (mayor.match(/NPC[0-9]+/) != null)
	const nationHasDefaultColor = (marker.color == '#3fb4ff' && marker.fillColor == '#3fb4ff') // Default blue

	// Universal properties for the map modes
	if (currentMapMode == 'alliances') {
		marker.fillColor = marker.color = '#000000'
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

async function main(data) {

	overrideZoomLimit()

	// Create town layer if there isn't
	if (!data.some(layer => layer.name == 'Territory')) {
		data.unshift({
			hide: true,
			name: 'Territory',
			control: true,
			id: 'towny',
			markers: []
		})
	}

	if (currentMapMode == 'archive') {
		const archiveData = await getArchive(data)
		if (!archiveData.ok) return null
		data = archiveData.data
	}

	// deprecated:
	// data = addChunksLayer(data
	if (isNostra) data = await addBordersLayer(data)

	if (!data?.[0]?.markers?.length && !isNostra) {
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

function modifySettings(data) {
	data['player_tracker'].nameplates['show_heads'] = true
	data['player_tracker'].nameplates['heads_url'] = 'https://mc-heads.net/avatar/{uuid}/16'
	data.zoom.def = 0
	data.spawn = { x: 2000, z: -10000 } // Set camera on Europe
	if (currentMapMode == 'archive') data['player_tracker'].enabled = false
	return data
}

function firstTimeMessage() {
	if (!localStorage['emcdynmapplus-first-time']) {
		sendMessage(`Unexpected updates to EarthMC may cause this extension to temporarily stop working.
			We are neither affiliated with EarthMC nor responsible for archiving map snapshots.
			Check for announcements or report bugs <a target="_blank" href="https://discord.gg/AVtgkcRgFs">here</a>.`)
		if (!isNostra) document.querySelector('#message-close').addEventListener('click', event => {
			sendMessage(`This is a deprecated website and the archive mode is disabled here.
				Try doing this <a href="https://map.earthmc.net">here</a> instead. You will see this message only once.`)
		})
		localStorage['emcdynmapplus-first-time'] = 'false'
	}
}

function init() {
	// Initialize some variables
	localStorage['emcdynmapplus-mapmode'] = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
	localStorage['emcdynmapplus-darkened'] = localStorage['emcdynmapplus-darkened'] ?? true
	localStorage['emcdynmapplus-capital-stars'] = localStorage['emcdynmapplus-capital-stars'] ?? true
	localStorage['emcdynmapplus-archive-mode-world'] = localStorage['emcdynmapplus-archive-mode-world'] ?? 'Terra Nostra'
	if (!isNostra && localStorage['emcdynmapplus-archive-mode-world'] == 'Terra Nostra') {
		localStorage['emcdynmapplus-archive-mode-world'] = 'Terra Aurora'
	}

	waitForHTMLelement('.leaflet-tile-pane').then(() => {
		if (localStorage['emcdynmapplus-darkened'] == 'true') decreaseBrightness(true)
	})

	waitForHTMLelement('.leaflet-top.leaflet-left').then(element => {
		element.addEventListener('mousedown', (event) => event.stopPropagation())
		addMainMenu(element)
	})

	toggleDarkMode(localStorage['emcdynmapplus-darkmode'] == 'true')
	toggleCapitalStars(localStorage['emcdynmapplus-capital-stars'] == 'true')

	// Fix nameplates appearing over popups
	waitForHTMLelement('.leaflet-nameplate-pane').then(element => element.style = '')

	// deprecated:
	// addPlayerList()
	if (currentMapMode == 'archive' || !isNostra) waitForHTMLelement('#sidebar').then(element => element.style.display = 'none')

	firstTimeMessage()

	addElement(document.documentElement, htmlCode.followingPlayer, '#followingWarning')
    doesFollowPlayerInterval()

	checkForUpdate()
}

init()

function addMainMenu(parent) {
	const sidebar = addElement(parent, htmlCode.sidebar, '#emcdynmapplus-sidebar')

	addLocateMenu(sidebar)

	if (isNostra) {
		const archiveContainer = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[2]
		const archiveButton = addElement(archiveContainer, htmlCode.buttons.searchArchive, '#archive-button')
		const archiveInput = addElement(archiveContainer, htmlCode.archiveInput, '#archive-input')
		archiveButton.addEventListener('click', () => searchArchive(archiveInput.value))
		archiveInput.addEventListener('keyup', event => {
			if (event.key == 'Enter') searchArchive(archiveInput.value)
		})
	}

	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode + '<br>', '#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	/* deprecated:
	if (currentMapMode != 'archive' && isNostra) {
		const togglePlayerListButton = addElement(sidebar, htmlCode.buttons.togglePlayerList + '<br>', '#toggle-player-list')
		togglePlayerListButton.addEventListener('click', () => {
			const playerList = document.getElementById('players')
			const isVisible = playerList.style.display == 'grid'
			playerList.style.display = isVisible ? 'none' : 'grid'
			if (!isVisible && !localStorage['emcdynmapplus-first-time-player-list']) {
				localStorage['emcdynmapplus-first-time-player-list'] = 'false'
				sendMessage('If tracking players functionality breaks, refresh the website. You will see this message once.')
			}
		})
	}
	*/

	addOptions(sidebar)

	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel, '#current-map-mode-label')
	let currentMapModeText = currentMapMode
	if ((currentMapMode == 'meganations' || currentMapMode == 'alliances') && isNostra) {
		currentMapModeText += ` <a style="text-decoration: none" target="_blank"
		href="https://discord.gg/AVtgkcRgFs"><abbr style="text-decoration: none"
		title="You can register a meganation or an alliance by clicking here">❓</abbr></a>`
	}
	currentMapModeLabel.innerHTML = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapModeText)
}

function decreaseBrightness(isChecked) {
	const element = document.querySelector('.leaflet-tile-pane')
	const imageOverlay = document.querySelector('.leaflet-image-layer')
	localStorage['emcdynmapplus-darkened'] = isChecked
	if (element) element.style.filter = (isChecked) ? 'brightness(50%)' : ''
	if (imageOverlay) imageOverlay.style.filter = (isChecked) ? 'brightness(50%)' : ''
}

function toggleCacheArchives(isChecked) {
	localStorage['emcdynmapplus-cache-archives'] = isChecked
}

function switchMapMode() {
	const nextMapMode = {
		meganations: 'alliances',
		alliances: 'default',
		default: 'meganations'
	}
	localStorage['emcdynmapplus-mapmode'] = nextMapMode[currentMapMode] ?? 'meganations'
	location.reload()
}

function toggleDarkMode(isChecked) {
	localStorage['emcdynmapplus-darkmode'] = isChecked
	if (isChecked) {
		document.head.insertAdjacentHTML('beforeend',
			`<style id="dark-mode">
			.leaflet-control, #message-box, #prompt-box, .sidebar-input,
.sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top,
.leaflet-popup-content-wrapper, .leaflet-popup-tip,
.leaflet-bar > a.leaflet-disabled, #archive-mode-world {
    background: #111;
    color: #bbb;
    box-shadow: 0 0 2px 1px #bbb;
}

.leaflet-control-layers.link > a > img,
input[type="checkbox"] {
    filter: invert();
}
			</style>`
		) // {dark-mode.css} is dynamically injected during build
	}
	else document.querySelector('#dark-mode')?.remove()
}

function toggleCapitalStars(isChecked) {
	localStorage['emcdynmapplus-capital-stars'] = isChecked
	if (!isChecked) {
		waitForHTMLelement('head').then(() => {
			document.head.insertAdjacentHTML('beforeend',
				`<style id="toggle-capital-stars">
				img[src='images/icon/registered/towny_capital_icon.png'] { display: none; }
				</style>`
			)
		})
	}
	else document.querySelector('#toggle-capital-stars')?.remove()
}

function addOptions(sidebar) {
	const optionsButton = addElement(sidebar, htmlCode.buttons.options, '#options-button')
	const optionsMenu = addElement(sidebar, htmlCode.options.menu, '#options-menu')
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', () => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'unset' : 'none'
	})

	let i = 0 // option index
	const checkbox = {
		decreaseBrightness: addOption(i++, 'decrease-brightness', 'Decrease brightness', 'darkened'),
		darkMode: addOption(i++, 'toggle-darkmode', 'Toggle dark mode', 'darkmode'),
		cacheArchives: isNostra ? addOption(i++, 'cache-archives', `<abbr title="Save archive mode's snapshots
			from specific dates in your browser to load them faster next time.
			One save file weighs a few megabytes.">Save archives</abbr>`.replace(/\s+/g, ' '), 'cache-archives') : null,
		capitalStars: addOption(i++, 'toggle-capital-stars', 'Toggle capital stars', 'capital-stars'),
	}

	// Archive mode world
	if (isNostra) {
		const archiveModeWorld = addElement(optionsMenu, htmlCode.options.option, '.option', true)[i++]
		archiveModeWorld.insertAdjacentHTML('beforeend', htmlCode.options.label
			.replace('{option}', 'archive-mode-world')
			.replace('{optionName}', `<abbr title="Choose a world to load archive mode's snapshots from.">Archive mode world</abbr>`))
		archiveModeWorld.style.display = 'unset'
		const currentArchiveWorld = localStorage['emcdynmapplus-archive-mode-world']
		const selectHTML = htmlCode.options.archiveWorldMode.replace('{current}', currentArchiveWorld)
		const select = addElement(archiveModeWorld, selectHTML, '#archive-mode-world')
		for (const world of ['Classic', 'Terra Nova', 'Terra Aurora', 'Terra Nostra']) {
			select.insertAdjacentHTML('beforeend', `<option>${world}</option>`)
		}
		select.addEventListener('change', event => {
			localStorage['emcdynmapplus-archive-mode-world'] = select.value
			updateArchiveInput()
		})
	}

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
	checkbox.cacheArchives?.addEventListener('change', event => toggleCacheArchives(event.target.checked))
	checkbox.capitalStars.addEventListener('change', event => toggleCapitalStars(event.target.checked))

	// Clear local storage & OPFS
	const clearStorage = addElement(optionsMenu, htmlCode.options.option, '.option', true)[i++]
	clearStorage.style.display = 'unset'
	const clearStorageButton = addElement(clearStorage, htmlCode.options.clearStorage, '#clear-storage')
	clearStorageButton.addEventListener('click', async () => {
		if (!window.confirm('Use this to attempt to fix an issue or update something manually.')) return
		localStorage.clear()
		const opfs = await navigator.storage.getDirectory()
		opfs.remove()
		location.reload()
	})

	if (isNostra) updateArchiveInput()
}
function updateArchiveInput() {
	const archiveModeWorldVariable = localStorage['emcdynmapplus-archive-mode-world'] ?? 'Terra Nostra'
	const archiveInput = document.querySelector('#archive-input')
	const worldDates = {
		'Classic': { min: '2017-09-06', max: '2018-07-07' },
		'Terra Nova': { min: '2018-12-17', max: '2024-06-17' },
		'Terra Aurora': { min: '2022-05-01', max: '2026-04-12' },
		'Terra Nostra': { min: '2026-04-17', max: new Date().toLocaleDateString('en-ca') }
	}
	const config = worldDates[archiveModeWorldVariable]
	archiveInput.min = config.min
	archiveInput.max = config.max
}

function searchArchive(date) {
	if (date == '') return
	const URLDate = date.replaceAll('-', '')
	localStorage['emcdynmapplus-archive-date'] = URLDate
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
}

function addLocateMenu(sidebar) {
	const locateMenu = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[0]
	locateMenu.id = 'locate-menu'
	const locateText = currentMapMode == 'archive' ? 'Locate (archive)' : 'Locate'
	const locateButton = addElement(locateMenu, htmlCode.buttons.locate.replace('{locate-text}', locateText), '#locate-button')
	const locateSubmenu = addElement(locateMenu, htmlCode.sidebarOption, '.sidebar-option')
	const locateSelect = addElement(locateSubmenu, htmlCode.locateSelect, '#locate-select')
	const locateInput = addElement(locateSubmenu, htmlCode.locateInput, '#locate-input')
	locateSelect.addEventListener('change', () => {
		switch (locateSelect.value) {
			case 'Town': locateInput.placeholder = 'London'; break
			case 'Nation': locateInput.placeholder = 'Germany'; break
			case 'Resident': locateInput.placeholder = 'Notch'; break
		}
	})
	locateInput.addEventListener('keyup', event => {
		if (event.key != 'Enter') return
		locate(locateSelect.value, locateInput.value)
	})
	locateButton.addEventListener('click', () => {
		locate(locateSelect.value, locateInput.value)
	})
}

function addOption(index, optionId, optionName, variable) {
	const optionsMenu = document.querySelector('#options-menu')
	const option = addElement(optionsMenu, htmlCode.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', optionId)
		.replace('{optionName}', optionName))
	const checkbox = addElement(option, htmlCode.options.checkbox.replace('{option}', optionId), '#' + optionId)
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

function doesFollowPlayerInterval() {
    const isFollowingPlayer = document.querySelector('.following') != null
    document.querySelector('#followingWarning').style.display = isFollowingPlayer ? 'unset' : 'none'
    requestAnimationFrame(doesFollowPlayerInterval)
}

// deprecated:
function addPlayerList() {
	waitForHTMLelement('#players').then(() => {
		const playerList = document.getElementById('players')
		const mapElement = document.getElementById('map')
		mapElement.appendChild(playerList)
		playerList.addEventListener('wheel', (event) => {event.stopImmediatePropagation()})
	})
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

// Clickable player nameplates
waitForHTMLelement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) lookupPlayer(username, false)
	})
})

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

	// Resident lists
	const residentList = (currentMapMode == 'archive' || !isNostra) ? residents :
		residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorList = (currentMapMode == 'archive' || !isNostra) ? councillors :
		councillors.map(councillor => htmlCode.residentClickable.replaceAll('{player}', councillor)).join(', ')

	// Modify resident list
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, htmlCode.scrollableResidentList.replace('{list}', residentList))
	} else {
		marker.popup = marker.popup.replace(residents + '\n', htmlCode.residentList.replace('{list}', residentList) + '\n')
	}

	if (currentMapMode != 'archive' && isNostra) {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`)
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`)
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

function sendMessage(message) {
	if (document.querySelector('#message-box') != null) document.querySelector('#message-box').remove()
	document.documentElement.insertAdjacentHTML('beforeend', htmlCode.messageBox.replace('{message}', message))
	document.querySelector('#message-close').addEventListener('click', event => { event.target.parentElement.remove() })
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
		observer.observe(document.documentElement, { childList: true, subtree: true })
	})
}

function addElement(parent, element, returnWhat, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(returnWhat) : parent.querySelectorAll(returnWhat)
}

async function saveToOPFS(file, text) {
	const fileSystem = await navigator.storage.getDirectory()
	let fileHandle = await fileSystem.getFileHandle(file, {create: true})
	const writable = await fileHandle.createWritable()
	await writable.write(text)
	await writable.close()
}

async function getOPFS(filename) {
	try {
		const fileSystem = await navigator.storage.getDirectory()
		let fileHandle = await fileSystem.getFileHandle(filename)
		const file = await fileHandle.getFile()
		return await file.text()
	} catch (e) {
		return null
	}
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

function overrideZoomLimit() {
	const Leaflet = !isExtension ? unsafeWindow.L : window.L
	Leaflet.Map.prototype.getMinZoom = function () { return -2 }

    const native_clampZoom = Leaflet.GridLayer.prototype._clampZoom
    Leaflet.GridLayer.prototype._clampZoom = function (zoom, ...args) {
        this.options.minZoom = -2
        return native_clampZoom.call(this, zoom, ...args)
    }

    const native_getTileUrl = Leaflet.TileLayer.prototype.getTileUrl
    Leaflet.TileLayer.prototype.getTileUrl = function (coords) {
        coords.z = Math.max(0, coords.z)
        return native_getTileUrl.call(this, coords)
    }
}

function appendStyle() {
    const head = document.head || document.getElementsByTagName('head')[0]
	const style = document.createElement('style')
	head.appendChild(style)
	style.appendChild(document.createTextNode(css))
}

appendStyle()

// Include @grant GM.xmlHttpRequest in userscript description!

async function corsFetch(url, options = null) {
    const json = {
        url: url,
        method: options?.method ?? 'GET',
        data: options?.body ?? undefined
    }
    let test = await GM.xmlHttpRequest(json)
    return test
}

// Replace the default fetch() with ours to intercept responses
let preventMapUpdate = false
const actualWindow = isExtension ? window : unsafeWindow
actualWindow.fetch = async (...args) => {
	const response = await originalFetch(...args)

	const playerList = document.querySelector('fieldset#players')
	if (response.url.includes('players.json') && playerList) {
		const scroll = playerList.scrollTop
		const observer = new MutationObserver(() => {
			playerList.scrollTop = scroll
			observer.disconnect()
		})
    	observer.observe(playerList, { childList: true, subtree: true })
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