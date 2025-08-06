const htmlCode = {
	buttons: {
		locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
		searchArchive: '<button class="sidebar-button" id="archive-button">Search archive</button>',
		options: '<button class="sidebar-button" id="options-button">Options</button>',
		switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>'
	},
	options: {
		menu: '<div id="options-menu"></div>',
		option: '<div class="option"></div>',
		label: '<label for="{option}">{optionName}</label>',
		checkbox: '<input id="{option}" type="checkbox" name="{option}">',
	},
	sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
	sidebarOption: '<div class="sidebar-option"></div>',
	locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
	locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
	archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="2022-05-01" max="${new Date().toLocaleDateString('en-ca')}">`,
	currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
	alertBox: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>'
}
const apiURL = 'https://api.earthmc.net/v3/aurora'
const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'

init()

function sendAlert(message) {
	if (document.querySelector('#alert') != null) document.querySelector('#alert').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.alertBox.replace('{message}', message))
	document.querySelector('#alert-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

function injectMainScript() {
	const mainScript = document.createElement('script')
	mainScript.src = chrome.runtime.getURL('main.js')
	mainScript.onload = function () { this.remove() };
	(document.head || document.documentElement).appendChild(mainScript)
}

function waitForHTMLelement(selector) {
	return new Promise(resolve => {
		if (document.querySelector(selector)) return resolve(document.querySelector(selector))

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
	const sidebar = addElement(parent, htmlCode.sidebar, '#sidebar')

	addLocateMenu(sidebar)

	// Search archive
	const archiveContainer = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[2]
	const archiveButton = addElement(archiveContainer, htmlCode.buttons.searchArchive, '#archive-button')
	const archiveInput = addElement(archiveContainer, htmlCode.archiveInput, '#archive-input')
	archiveButton.addEventListener('click', () => searchArchive(archiveInput.value))
	archiveInput.addEventListener('keyup', event => {
		if (event.key == 'Enter') searchArchive(archiveInput.value)
	})

	// Switch map mode button
	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode + '<br>', '#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	addOptions(sidebar)

	// Current map mode label
	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel, '#current-map-mode-label')
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode)
}

function decreaseBrightness(isChecked) {
	const element = document.querySelector('.leaflet-tile-pane')
	localStorage['emcdynmapplus-darkened'] = isChecked
	element.style.filter = (isChecked) ? 'brightness(50%)' : ''
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

function init() {
	injectMainScript()
	localStorage['emcdynmapplus-mapmode'] = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
	localStorage['emcdynmapplus-darkened'] = localStorage['emcdynmapplus-darkened'] ?? true

	waitForHTMLelement('.leaflet-tile-pane').then(() => {
		if (localStorage['emcdynmapplus-darkened'] == 'true') decreaseBrightness(true)
	})
	waitForHTMLelement('.leaflet-top.leaflet-left').then(element => addMainMenu(element))

	if (localStorage['emcdynmapplus-darkmode'] == 'true') loadDarkMode()
	// Fix nameplates appearing over popups
	waitForHTMLelement('.leaflet-nameplate-pane').then(element => element.style = '')

	checkForUpdate()
}

function loadDarkMode() {
	document.head.insertAdjacentHTML('beforeend',
		`<style id="dark-mode">
		.leaflet-control, #alert, .sidebar-input,
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
		const changelogURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/v' + version.latest
		sendAlert(`Extension has been automatically updated from ${version.cached} to ${version.latest}. Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.`)
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
		darkMode: addOption(1, 'toggle-darkmode', 'Toggle dark mode', 'darkmode')
	}

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
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
	const response = await fetch(url, options)
	if (response.status == 404) return false
	else if (response.ok) return response.json()
	else return null
}

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const coords = await getTownSpawn(town)
	if (coords == false) return sendAlert('Searched town has not been found.')
	if (coords == null) return sendAlert('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	const query = { query: [encodeURIComponent(nation)], template: { capital: true } }
	const data = await fetchJSON(apiURL + '/nations', {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return sendAlert('Searched nation has not been found.')
	if (data == null) return sendAlert('Service is currently unavailable, please try later.')

	const capital = data[0].capital.name
	const coords = await getTownSpawn(capital)
	if (coords == false) return sendAlert('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return sendAlert('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	const query = { query: [encodeURIComponent(resident)], template: { town: true } }
	const data = await fetchJSON(apiURL + '/players', {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return sendAlert('Searched resident has not been found.')
	if (data == null) return sendAlert('Service is currently unavailable, please try later.')

	const town = data[0].town.name
	if (!town) return sendAlert('The searched resident is townless.')
	const coords = await getTownSpawn(town)
	if (coords == false) return sendAlert('Unexpected error occurred while searching for resident, please try later.')
	if (coords == null) return sendAlert('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function getTownSpawn(town) {
	const query = { query: [encodeURIComponent(town)], template: { coordinates: true } }
	const data = await fetchJSON(apiURL + '/towns', {method: 'POST', body: JSON.stringify(query)})
	if (data == false || data == undefined) return false
	if (data == null) return null
	return { x: Math.round(data[0].coordinates.spawn.x), z: Math.round(data[0].coordinates.spawn.z) }
}