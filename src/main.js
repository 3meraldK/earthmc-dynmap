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
		addMainMenu(element)
		try { checkForUpdateUserscript(element) } // For userscript
		catch (error) { /* Do nothing if it's extension */ }
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

	try { checkForUpdate(element) } // For extension
	catch (error) { /* Do nothing if it's userscript */ }
}

init()