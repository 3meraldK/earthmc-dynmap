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

	if (!isNostra) data = addChunksLayer(data)
	data = await addCountryLayer(data)

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

// TODO: This should be removed and integrated within the css directory 
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

	waitForHTMLelement('#sidebar').then(element => element.remove())

	firstTimeMessage()

    tick()

	// For extension only
	// checkForUpdate()
}

init()

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
	currentMapModeLabel.style.display = 'block'
	let currentMapModeText = currentMapMode
	if ((currentMapMode == 'meganations' || currentMapMode == 'alliances') && isNostra) {
		currentMapModeText += ` <a style="text-decoration: none" target="_blank" href="https://discord.gg/AVtgkcRgFs"><abbr style="text-decoration: none" title="You can register a meganation or an alliance here">ℹ️</abbr></a>`
	}
	currentMapModeLabel.innerHTML = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapModeText)
}

function decreaseBrightness(isChecked) {
	const element = document.querySelector('.leaflet-tile-pane')
	localStorage['emcdynmapplus-darkened'] = isChecked
	element.style.filter = (isChecked) ? 'brightness(50%)' : ''
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