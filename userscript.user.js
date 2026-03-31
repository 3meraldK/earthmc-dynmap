// ==UserScript==
// @name         EarthMC Dynmap+
// @version      26.1
// @description  Enrich the EarthMC map exploration's experience
// @author       3meraldK
// @match        https://map.earthmc.net/*
// @match        https://nostra.earthmc.net/*
// @iconURL      https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png
// ==/UserScript==

// Both files

const htmlCode = {
	// main.js
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
	partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayerFunc(\'{player}\')">{player}</span>', // Different function than in main.js
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
	promptBox: '<div id="message-box"><p id="message">{message}</p></div>',
	// content.js
	buttons: {
		locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
		searchArchive: '<button class="sidebar-button" id="archive-button">Search archive</button>',
		options: '<button class="sidebar-button" id="options-button">Options</button>',
		switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>',
		togglePlayerList: '<button class="sidebar-input" id="toggle-player-list">Toggle player list</button>'
	},
	options: {
		menu: '<div id="options-menu"></div>',
		option: '<div class="option"></div>',
		label: '<label for="{option}">{optionName}</label>',
		checkbox: '<input id="{option}" type="checkbox" name="{option}">',
	},
	sidebar: '<div class="leaflet-control-layers leaflet-control" id="emcdynmapplus-sidebar"></div>',
	sidebarOption: '<div class="sidebar-option"></div>',
	locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
	locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
	archiveInput: `<input class="sidebar-input" id="archive-input" type="date">`,
	currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
	followingPlayer: '<h1 id="followingWarning">Click on map to unfollow player</h1>',
	// For userscript
	updateNotification: '<div class="leaflet-control-layers leaflet-control left-container" id="update-notification">{text}<br><span class="close-container">×</span></div>',
	// For both
	messageBox: '<div id="message-box"><p id="message">{message}</p><br><button id="message-close">OK</button></div>'
}

const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
const isNostra = location.href.includes('nostra')
const apiURL = 'https://api.earthmc.net/v4/aurora'
const proxyURL = 'https://proxy.killcors.com/?url='
const chosenArchiveDate = parseInt(localStorage['emcdynmapplus-archive-date'])

function sendMessage(message) {
	if (document.querySelector('#message-box') != null) document.querySelector('#message-box').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.messageBox.replace('{message}', message))
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
		observer.observe(document.body, { childList: true, subtree: true })
	})
}

function addElement(parent, element, returnWhat, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(returnWhat) : parent.querySelectorAll(returnWhat)
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

// content.js

init()

// For extension only
// injectMainScript()

function addMainMenu(parent) {
	const sidebar = addElement(parent, htmlCode.sidebar, '#emcdynmapplus-sidebar')

	addLocateMenu(sidebar)

	const archiveContainer = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[2]
	const archiveButton = addElement(archiveContainer, htmlCode.buttons.searchArchive, '#archive-button')
	const archiveInput = addElement(archiveContainer, htmlCode.archiveInput, '#archive-input')
	archiveButton.addEventListener('click', () => searchArchive(archiveInput.value))
	archiveInput.addEventListener('keyup', event => {
		if (event.key == 'Enter') searchArchive(archiveInput.value)
	})

	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode + '<br>', '#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	const togglePlayerListButton = addElement(sidebar, htmlCode.buttons.togglePlayerList + '<br>', '#toggle-player-list')
	togglePlayerListButton.addEventListener('click', () => {
		if (currentMapMode == 'archive') return sendMessage(`Can't view player list in archive mode.`)
        const playerList = document.getElementById('players')
        const isVisible = playerList.style.display == 'grid'
        playerList.style.display = isVisible ? 'none' : 'grid'
		if (!isVisible && !localStorage['emcdynmapplus-first-time-player-list']) {
			localStorage['emcdynmapplus-first-time-player-list'] = 'false'
			sendMessage('If tracking players functionality breaks, refresh the website. You will see this message once.')
		}
    })

	addOptions(sidebar)

	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel, '#current-map-mode-label')
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode)
}

function decreaseBrightness(isChecked) {
	const element = document.querySelector('.leaflet-tile-pane')
	localStorage['emcdynmapplus-darkened'] = isChecked
	element.style.filter = (isChecked) ? 'brightness(50%)' : ''
}

function toggleTerraNovaArchives(isChecked) {
	const element = document.querySelector('#archive-input')
	element.value = ''
	localStorage['emcdynmapplus-terra-nova-archive'] = isChecked
	element.min = (isChecked) ? '2018-12-17' : '2022-05-01'
	element.max = (isChecked) ? '2024-06-17' : new Date().toLocaleDateString('en-ca')
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

function addPlayerList() {
	waitForHTMLelement('#players').then(() => {
		const playerList = document.getElementById('players')
		const mapElement = document.getElementById('map')
		mapElement.appendChild(playerList)
		playerList.addEventListener('wheel', (event) => {event.stopImmediatePropagation()})
	})
	addElement(document.body, htmlCode.followingPlayer, '#followingWarning')
}

function init() {
	// injectMainScript() - for extension only
	// Initialize some variables
	localStorage['emcdynmapplus-mapmode'] = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
	localStorage['emcdynmapplus-darkened'] = localStorage['emcdynmapplus-darkened'] ?? true

	waitForHTMLelement('.leaflet-tile-pane').then(() => {
		if (localStorage['emcdynmapplus-darkened'] == 'true') decreaseBrightness(true)
	})

	waitForHTMLelement('.leaflet-top.leaflet-left').then(element => {
		addMainMenu(element)
		checkForUpdateUserscript(element) // For userscript
	})

	if (localStorage['emcdynmapplus-darkmode'] == 'true') loadDarkMode()

	// Fix nameplates appearing over popups
	waitForHTMLelement('.leaflet-nameplate-pane').then(element => element.style = '')

	addPlayerList()

	firstTimeMessage()

    tick()

	// For extension only
	// checkForUpdate()
}

function firstTimeMessage() {
	if (!localStorage['emcdynmapplus-first-time']) {
		const threadURL = 'https://discord.com/channels/219863747248914433/1047061595861286912'
		sendMessage(`The extension's maintainers aren't affiliated with EarthMC and responsible for archiving maps.
			Please keep in mind, that the extension may temporarily render unusable due to unexpected EarthMC
			or third-party updates. If that was the case, the maintainers would address potential problems
			sooner or later likely through the communications channel on
			<a target="_blank" href="${threadURL}">EarthMC Discord thread</a>.`)
		localStorage['emcdynmapplus-first-time'] = 'false'
	}
}

function tick() {
    const isFollowingPlayer = document.querySelector('.following') != null
    document.querySelector('#followingWarning').style.display = isFollowingPlayer ? 'unset' : 'none'
    requestAnimationFrame(tick)
}

function loadDarkMode() {
	document.head.insertAdjacentHTML('beforeend',
		`<style id="dark-mode">
		.leaflet-control, #message-box, #prompt-box, .sidebar-input,
		.sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top,
		.leaflet-popup-content-wrapper, .leaflet-popup-tip,
		.leaflet-bar > a.leaflet-disabled {
			background: #111;
			color: #bbb;
			box-shadow: 0 0 2px 1px #bbb;
		}
		div.leaflet-control-layers.link img {
			filter: invert(1);
		}</style>`
	)
}

function toggleDarkMode(isChecked) {
	if (isChecked) {
		localStorage['emcdynmapplus-darkmode'] = true
		loadDarkMode()
	}
	else {
		localStorage['emcdynmapplus-darkmode'] = false
		document.querySelector('#dark-mode').remove()
		waitForHTMLelement('.leaflet-map-pane').then(element => element.style.filter = '')
	}
}

function locate(selectValue, inputValue) {
	switch (selectValue) {
		case 'Town': locateTown(inputValue); break
		case 'Nation': locateNation(inputValue); break
		case 'Resident': locateResident(inputValue); break
	}
}

// For extension only
// function checkForUpdate()

function addOptions(sidebar) {
	const optionsButton = addElement(sidebar, htmlCode.buttons.options, '#options-button')
	const optionsMenu = addElement(sidebar, htmlCode.options.menu, '#options-menu')
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', () => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'unset' : 'none'
	})

	const checkbox = {
		decreaseBrightness: addOption(0, 'decrease-brightness', 'Decrease brightness', 'darkened'),
		darkMode: addOption(1, 'toggle-darkmode', 'Toggle dark mode', 'darkmode'),
		terraNovaArchive: addOption(2, 'terra-nova-archive', '<abbr title="If checked, archive mode will display Terra Nova towns">Terra Nova archives</abbr>', 'terra-nova-archive'),
		cacheArchives: addOption(3, 'cache-archives', `<abbr title="Save archive mode snapshots in your browser's Origin Private File System for its instant load upon next time. One cache weighs a few MBs.">Cache archives</abbr>`, 'cache-archives')
	}

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
	checkbox.terraNovaArchive.addEventListener('change', event => toggleTerraNovaArchives(event.target.checked))
	checkbox.cacheArchives.addEventListener('change', event => toggleCacheArchives(event.target.checked))

	const terraNovaArchive = localStorage['emcdynmapplus-terra-nova-archive']
	document.querySelector('#archive-input').min = terraNovaArchive == 'true' ? '2018-12-17' : '2022-05-01'
	document.querySelector('#archive-input').max = terraNovaArchive == 'true' ? '2024-06-17' : new Date().toLocaleDateString('en-ca')
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
	const locateButton = addElement(locateMenu, htmlCode.buttons.locate, '#locate-button')
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

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const coords = await getTownSpawn(town)
	if (coords == false) return sendMessage('Searched town has not been found.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	if (currentMapMode == 'archive') {
		return sendMessage(`Can't search for archived nations. Exit archive mode to proceed.`)
	}

	const query = { query: [nation], template: { capital: true } }
	const data = await fetchJSON(apiURL + '/nations', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')
	if (!data.data) return sendMessage('Searched nation has not been found.')

	let capital
	try { capital = data.data[0].capital.name }
	catch { return sendMessage('Searched nation has not been found.') }
	const coords = await getTownSpawn(capital)
	if (coords == false) return sendMessage('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	if (currentMapMode == 'archive') {
		return sendMessage(`Can't search for archived residents. Exit archive mode to proceed.`)
	}

	const query = { query: [resident], template: { town: true } }
	const data = await fetchJSON(apiURL + '/players', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')

	try {
		const town = data.data[0].town.name
		const coords = await getTownSpawn(town)
		if (coords == false) return sendMessage('Unexpected error occurred while searching for resident, please try later.')
		if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
		location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
	} catch {
		return sendMessage(`The searched resident is townless or they opted out of being looked up.`)
	}
}

async function getTownSpawn(town) {
	// Archive mode works with towns only
	if (currentMapMode == 'archive') {
		markersURL = getArchiveURL()
		let archive = await fetchJSON(proxyURL + markersURL)

		if (!archive.ok) return null
		if (!archive.data) return false

		archive = {data: [{markers: []}]}

		if (chosenArchiveDate < 20200322) {
			archive.data[0].markers = convertOldMarkersStructure(archive.data.sets['towny.markerset'])
		} else if (chosenArchiveDate < 20240623) {
			archive.data[0].markers = convertOldMarkersStructure(archive.data.sets['townyPlugin.markerset'])
		}

		let townObject = archive.data[0].markers.find(el => el.popup.toLowerCase().includes(`>${town} (`))
		if (!townObject) return false
		let points = townObject.points.flat(Infinity)
		let coords = { x: points[0].x, z: points[0].z }
		return coords
	}
	const query = { query: [town], template: { coordinates: true } }
	const data = await fetchJSON(apiURL + '/towns', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return null
	try { return { x: Math.round(data.data[0].coordinates.spawn.x), z: Math.round(data.data[0].coordinates.spawn.z) } }
	catch { return false }
}

// main.js

const { fetch: originalFetch } = unsafeWindow

// Make this function work in userscript
unsafeWindow.lookupPlayerFunc = lookupPlayer

const alliancesURL = 'https://emcstats.bot.nu/aurora/alliances'
const server = localStorage['emcdynmapplus-terra-nova-archive'] == 'true' ? 'nova' : 'aurora'

let alliances = null
if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)

// Clickable player nameplates
waitForHTMLelement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) lookupPlayer(username, false)
	})
})

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
	const residents = marker.popup.match(/Members <span style="font-weight:bold">(.*)<\/span><br \/>Flags/)?.[1]
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
		.replace(town, names.town)
		.replace(nation, names.nation)
		.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
		.replaceAll('false<', '&#9;<span style="color:red">No</span><')
		.replace(`Members <span`, `Members <b>[${residentNum}]</b> <span`)
	if (area > 0) {
		marker.popup = marker.popup
		.replace(`</span><br /> Members`, `</span><br>Size<span style="font-weight:bold"> ${area} </span><br> Members`)
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

	// Clickable resident lists
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

async function main(data) {

	if (currentMapMode == 'archive') {
		data = await getArchive(data)
	}

	data = addChunksLayer(data)
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

		// Create
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

async function getAlliances() {
	const response = await fetchJSON(alliancesURL)
	if (!response.ok || !response.data) {
		const cache = JSON.parse(localStorage['emcdynmapplus-alliances'])
		if (cache == null) {
			sendMessage('Service responsible for loading alliances will be available later.')
			return []
		}
		if (response.code != 429) { // 429 = too many requests
			sendMessage('Service responsible for loading alliances is currently unavailable, but locally-cached data will be used.')
		}
		return cache
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

async function cacheArchiveSnapshot(data, timestamp) {
	try {
		const fileSystem = await navigator.storage.getDirectory()
		let fileHandle
		try { fileHandle = await fileSystem.getFileHandle(`emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`) }
		catch (e) {fileHandle = await fileSystem.getFileHandle(`emcdynmapplus-archive-cache-${server}-${chosenArchiveDate}`, {create: true}) }
		const writable = await fileHandle.createWritable()
		await writable.write(JSON.stringify({data: data, timestamp: timestamp}))
		await writable.close()
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

let preventMapUpdate = false
unsafeWindow.fetch = async (...args) => { // unsafeWindow in userscript
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

// Userscript

async function checkForUpdateUserscript(parent) {
	const localVersion = GM_info.script.version
	const manifest = await fetchJSON('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/manifest.json')
	if (!manifest.ok) return console.log('EarthMC Dynmap+ could not check for update.')
	const latestVersion = manifest?.data?.version
	if (!latestVersion || latestVersion == localVersion) return
	parent.insertAdjacentHTML('beforeend', htmlCode.updateNotification)
	const updateNotification = parent.querySelector('#update-notification')
	const repoURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
	const text = `EarthMC Dynmap+ update from ${localVersion} to ${latestVersion} is available. <a id="update-download-link" target="_blank" href="${repoURL}">Click here to download!</a>`
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{text}', text)
	updateNotification.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}

appendStyle()

// style.css

function appendStyle() {
	const css = `
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

	/* Player lookup */

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

	/* Main sidebar */

	.sidebar-option {
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

	/* Town popup */

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

	/* Message box */

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

	/* Clickable nameplates */

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

	/* Player list */

	fieldset#players {
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
	}

	#followingWarning {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 99999;
		color: white;
		font-family: Arial;
	}

	/* Update notification - for userscript */

	#update-download-link {
		font-weight: bold;
		text-decoration: none;
	}
	`

	const head = document.head || document.getElementsByTagName('head')[0]
	const style = document.createElement('style')
	head.appendChild(style)
	style.appendChild(document.createTextNode(css))
}