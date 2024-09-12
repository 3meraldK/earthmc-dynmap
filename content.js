const htmlCode = {
	sidebar: '<div class="leaflet-control-layers leaflet-control" id="emcdynmapplus-sidebar"></div>',
	updateNotification: '<div class="leaflet-control-layers leaflet-control left-container" id="update-notification">EarthMC Dynmap+ update from {localVersion} to {latestVersion} is available. <a id="update-download-link" href="https://github.com/3meraldK/earthmc-dynmap/releases/latest">Click here to download!</a><br><span class="close-container">X</span></div>',
	optionContainer: '<div class="option-container"></div>',
	locateTownInput: '<input class="sidebar-input" id="locate-town-input" placeholder="London">',
	locateTownButton: '<button class="sidebar-button" id="locate-town-button" type="submit">Locate town</button>',
	locateNationInput: '<input class="sidebar-input" id="locate-nation-input" placeholder="Germany">',
	locateNationButton: '<button class="sidebar-button" id="locate-nation-button" type="submit">Locate nation</button>',
	archiveInput: `<input class="sidebar-input" id="archive-input" style="width: 70px" type="date" min="2024-07-04" max="${new Date().toLocaleDateString('en-ca')}">`,
	archiveButton: '<button class="sidebar-button" id="archive-button" type="submit">Search archive</button>',
	switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>',
	toggleDarkMode: '<button class="sidebar-input" id="toggle-dark-mode">Toggle dark mode</button>',
	alert: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>',
	currentMapModeLabel: '<div class="option-container" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
	// menuButton: '<div class="leaflet-control-layers leaflet-control" id="emcdynmapplus-menu-button" style="width: 44px; height: 44px"><img src="https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png" style="width: 44px; image-rendering: unset"></div>'
}
const apiURL = 'https://api.earthmc.net/v3/aurora'

function sendAlert(message) {
	if (document.querySelector('#alert') != null) document.querySelector('#alert').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.alert)
	const alertMessage = document.querySelector('#alert-message')
	alertMessage.innerHTML = alertMessage.innerHTML.replace('{message}', message)
	document.querySelector('#alert-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

function injectMainScript() {
	const mainScript = document.createElement('script')
	mainScript.src = chrome.runtime.getURL('main.js')
	mainScript.onload = function () { this.remove() };
	(document.head || document.documentElement).appendChild(mainScript)
}

function waitForHTMLelement(selector, selectAll = false) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(selectAll ? document.querySelectorAll(selector) : document.querySelector(selector))
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(selectAll ? document.querySelectorAll(selector) : document.querySelector(selector))
                observer.disconnect()
            }
        })
        observer.observe(document.body, { childList: true, subtree: true })
    })
}

function addMainMenu(parent) {
	parent.insertAdjacentHTML('beforeend', htmlCode.sidebar)
	const sidebar = parent.querySelector('#emcdynmapplus-sidebar')

	/* Attempt to add main menu button for extension
	parent.insertAdjacentHTML('beforeend', htmlCode.menuButton)
	const menuButton = parent.querySelector('#emcdynmapplus-menu-button')
	menuButton.addEventListener('click', () => {
		sidebar.style.display = (sidebar.style.display == 'none') ? '' : 'none'
	})*/
	sidebar.insertAdjacentHTML('beforeend', htmlCode.optionContainer)
	const findTownContainer = parent.querySelector('.option-container')
	findTownContainer.insertAdjacentHTML('beforeend', htmlCode.locateTownButton)
	findTownContainer.insertAdjacentHTML('beforeend', htmlCode.locateTownInput)
	const locateTownButton = findTownContainer.querySelector('#locate-town-button')
	const locateTownInput = findTownContainer.querySelector('#locate-town-input')
	locateTownButton.addEventListener('click', () => locateTown(locateTownInput.value))
	locateTownInput.addEventListener('keyup', (event) => {
		if (event.key == 'Enter') locateTown(locateTownInput.value)
	})

	// Locate nation button
	sidebar.insertAdjacentHTML('beforeend', htmlCode.optionContainer)
	const findNationContainer = parent.querySelectorAll('.option-container')[1]
	findNationContainer.insertAdjacentHTML('beforeend', htmlCode.locateNationButton)
	findNationContainer.insertAdjacentHTML('beforeend', htmlCode.locateNationInput)
	const locateNationButton = findNationContainer.querySelector('#locate-nation-button')
	const locateNationInput = findNationContainer.querySelector('#locate-nation-input')
	locateNationButton.addEventListener('click', () => locateNation(locateNationInput.value))
	locateNationInput.addEventListener('keyup', (event) => {
		if (event.key == 'Enter') locateNation(locateNationInput.value)
	})

	// Search archive button
	sidebar.insertAdjacentHTML('beforeend', htmlCode.optionContainer)
	const archiveContainer = parent.querySelectorAll('.option-container')[2]
	archiveContainer.insertAdjacentHTML('beforeend', htmlCode.archiveButton)
	archiveContainer.insertAdjacentHTML('beforeend', htmlCode.archiveInput)
	const archiveButton = archiveContainer.querySelector('#archive-button')
	const archiveInput = archiveContainer.querySelector('#archive-input')
	archiveButton.addEventListener('click', () => searchArchive(archiveInput.value))
	archiveInput.addEventListener('keyup', (event) => {
		if (event.key == 'Enter') searchArchive(archiveInput.value)
	})

	// Switch map mode button
	sidebar.insertAdjacentHTML('beforeend', htmlCode.switchMapMode + '<br>')
	const switchMapModeButton = parent.querySelector('#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	// Dark mode button
	sidebar.insertAdjacentHTML('beforeend', htmlCode.toggleDarkMode + '<br>')
	const toggleDarkModeButton = parent.querySelector('#toggle-dark-mode')
	toggleDarkModeButton.addEventListener('click', () => toggleDarkMode())

	// Decrease brightness
	sidebar.insertAdjacentHTML('beforeend', htmlCode.decreaseBrightness)
	const decreaseBrightnessCheckbox = parent.querySelector('#decrease-brightness')
	const isChecked = (localStorage['emcdynmapplus-darkened'] == 'true')
	decreaseBrightnessCheckbox.checked = isChecked
	decreaseBrightnessCheckbox.addEventListener('change', (event) => decreaseBrightness(event.target.checked))

	// Current map mode label
	sidebar.insertAdjacentHTML('beforeend', '<hr style="margin: 0">')
	sidebar.insertAdjacentHTML('beforeend', htmlCode.currentMapModeLabel)
	const currentMapModeLabel = parent.querySelector('#current-map-mode-label')
	const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode)
}

function decreaseBrightness(isChecked) {
	const element = document.querySelector('.leaflet-tile-pane')
	if (isChecked) {
		element.style.filter = 'brightness(50%)'
		localStorage['emcdynmapplus-darkened'] = true
	}
	else {
		element.style.filter = ''
		localStorage['emcdynmapplus-darkened'] = false
	}
}

function switchMapMode() {
	const currentMapMode = localStorage['emcdynmapplus-mapmode']
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
	waitForHTMLelement('.leaflet-top.leaflet-left').then(element => {
		addMainMenu(element)
		checkForUpdate(element)
	})
	waitForHTMLelement('#update-notification-close').then(element => {
		element.addEventListener('click', () => { element.parentElement.remove() })
	})
	if (localStorage['emcdynmapplus-darkmode'] == 'true') loadDarkMode()
	// Fix nameplates appearing over popups
	waitForHTMLelement('.leaflet-nameplate-pane').then(element => element.style = '')
}

function loadDarkMode() {
	document.head.insertAdjacentHTML('beforeend',
		`<style id="dark-mode">
		.leaflet-control, #alert, .sidebar-input, .sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top, .leaflet-popup-content-wrapper, .leaflet-popup-tip, .leaflet-bar > a.leaflet-disabled {
			background: #111;
			color: #bbb;
			box-shadow: 0 0 2px 1px #bbb; }
		</style>`
	)
}

function toggleDarkMode() {
	const isDarkModeOn = localStorage.getItem('emcdynmapplus-darkmode') ?? 'false'
	if (isDarkModeOn == 'false') {
		localStorage['emcdynmapplus-darkmode'] = true
		loadDarkMode()
	} else {
		localStorage['emcdynmapplus-darkmode'] = false
		document.querySelector('#dark-mode').remove()
		waitForHTMLelement('.leaflet-map-pane').then(element => element.style.filter = '')
	}
}

async function fetchJSON(url, options = null) {
	const response = await fetch(url, options)
	if (response.status == 404) return false
	else if (response.ok) return response.json()
	else return null
}

async function searchArchive(date) {
	if (date == '') return
	sendAlert('Fetching archive, please wait.')
	const URLDate = date.replaceAll('-', '')
	const markersURL = `https://web.archive.org/web/${URLDate}id_/https://map.earthmc.net/tiles/minecraft_overworld/markers.json`
	const archive = await fetchJSON('https://api.codetabs.com/v1/proxy/?quest=' + markersURL)
	if (!archive) return sendAlert('Archive service is currently unavailable, please try later.')
	localStorage['emcdynmapplus-archive'] = JSON.stringify(archive)
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
}

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const query = { query: [encodeURIComponent(town)], template: { coordinates: true } }
	const data = await fetchJSON(apiURL + '/towns', {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return sendAlert('The searched town has not been found.')
	if (data == null) return sendAlert('Service is currently unavailable, please try later.')

	const coords = { x: Math.round(data[0].coordinates.spawn.x), z: Math.round(data[0].coordinates.spawn.z) }
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	const nationQuery = { query: [encodeURIComponent(nation)], template: { capital: true } }
	const nationData = await fetchJSON(apiURL + '/nations', {method: 'POST', body: JSON.stringify(nationQuery)})
	if (nationData == false) return sendAlert('The searched nation has not been found.')
	if (nationData == null) return sendAlert('Service is currently unavailable, please try later.')

	const capital = nationData[0].capital.name
	const townQuery = { query: [encodeURIComponent(capital)], template: { coordinates: true } }
	const townData = await fetchJSON(apiURL + '/towns', {method: 'POST', body: JSON.stringify(townQuery)})
	if (townData == false) return sendAlert('Some unexpected error occurred while searching for nation, please try later.')
	if (townData == null) return sendAlert('Service is currently unavailable, please try later.')

	const coords = { x: Math.round(townData[0].coordinates.spawn.x), z: Math.round(townData[0].coordinates.spawn.z) }
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function checkForUpdate(parent) {
	const localVersion = chrome.runtime.getManifest().version
	const manifest = await fetchJSON('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/manifest.json')
	if (!manifest) return console.log('EarthMC Dynmap+ could not check for update.')
	const latestVersion = manifest.version
	if (!latestVersion || latestVersion == localVersion) return
	parent.insertAdjacentHTML('beforeend', htmlCode.updateNotification)
	const updateNotification = parent.querySelector('#update-notification')
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{localVersion}', localVersion)
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{latestVersion}', latestVersion)
	updateNotification.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}

init()