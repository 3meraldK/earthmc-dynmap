const htmlCode = {
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
	messageBox: '<div id="message-box"><p id="message">{message}</p><br><button id="message-close">OK</button></div>'
}

const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
const isNostra = location.href.includes('nostra')
const apiURL = 'https://api.earthmc.net/v4/aurora'
const proxyURL = 'https://proxy.killcors.com/?url='
const chosenArchiveDate = parseInt(localStorage['emcdynmapplus-archive-date'])

init()

function sendMessage(message) {
	if (document.querySelector('#message-box') != null) document.querySelector('#message-box').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.messageBox.replace('{message}', message))
	document.querySelector('#message-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

function injectMainScript() {
	const mainScript = document.createElement('script')
	mainScript.src = chrome.runtime.getURL('main.js')
	mainScript.onload = function () { this.remove() };
	(document.head || document.documentElement).appendChild(mainScript)
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
	injectMainScript()
	// Initialize some variables
	localStorage['emcdynmapplus-mapmode'] = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
	localStorage['emcdynmapplus-darkened'] = localStorage['emcdynmapplus-darkened'] ?? true

	// Decrease brightness
	waitForHTMLelement('.leaflet-tile-pane').then(() => {
		if (localStorage['emcdynmapplus-darkened'] == 'true') decreaseBrightness(true)
	})

	waitForHTMLelement('.leaflet-top.leaflet-left').then(element => addMainMenu(element))

	if (localStorage['emcdynmapplus-darkmode'] == 'true') loadDarkMode()
	// Fix nameplates appearing over popups
	waitForHTMLelement('.leaflet-nameplate-pane').then(element => element.style = '')

	addPlayerList()

	firstTimeMessage()

    tick()

	checkForUpdate()
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

function checkForUpdate() {
	const version = {
		cached: localStorage['emcdynmapplus-version'],
		latest: chrome.runtime.getManifest().version
	}
	if (!version.cached) return localStorage['emcdynmapplus-version'] = version.latest
	if (version.cached != version.latest) {
		const changelogURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
		sendMessage(`Extension has been automatically updated from ${version.cached} to ${version.latest}. Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.`)
	}
	localStorage['emcdynmapplus-version'] = version.latest
}

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

function addElement(parent, element, returnWhat, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(returnWhat) : parent.querySelectorAll(returnWhat)
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
		date = 20240704  // skip frequent changes that week
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