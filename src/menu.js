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
		currentMapModeText += ` <a style="text-decoration: none" target="_blank" href="https://discord.gg/AVtgkcRgFs"><abbr style="text-decoration: none" title="You can register a meganation or an alliance by clicking here">ℹ️</abbr></a>`
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
			{dark-mode.css}
			</style>`
		) // {dark-mode.css} is dynamically injected during build
	}
	else document.querySelector('#dark-mode')?.remove()
}

function toggleCapitalStars(isChecked) {
	localStorage['emcdynmapplus-capital-stars'] = isChecked
	if (!isChecked) {
		document.head.insertAdjacentHTML('beforeend',
			`<style id="toggle-capital-stars">
			img[src='images/icon/registered/towny_capital_icon.png'] { display: none; }
			</style>`
		)
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
		cacheArchives: addOption(i++, 'cache-archives', `<abbr title="Save archive mode's snapshots from specific dates in your browser to load them faster next time. One save file weighs a few megabytes.">Save archives</abbr>`, 'cache-archives'),
		capitalStars: addOption(i++, 'toggle-capital-stars', 'Toggle capital stars', 'capital-stars'),
	}

	// Archive mode world
	const archiveModeWorld = addElement(optionsMenu, htmlCode.options.option, '.option', true)[i++]
	archiveModeWorld.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', 'archive-mode-world')
		.replace('{optionName}', `<abbr title="Choose a world to load archive mode's snapshots from.">Archive mode world</abbr>`))
	archiveModeWorld.style.display = 'unset'
	const currentArchiveWorld = localStorage['emcdynmapplus-archive-mode-world']
	const select = addElement(archiveModeWorld, htmlCode.options.archiveWorldMode.replace('{current}', currentArchiveWorld), '#archive-mode-world')
	select.addEventListener('change', event => {
		if (select.value == 'Terra Nostra' && !isNostra) {
			sendMessage(`You can't choose this world on this website.`)
			select.value = localStorage['emcdynmapplus-archive-mode-world']
			return
		}
		localStorage['emcdynmapplus-archive-mode-world'] = select.value
		updateArchiveInput()
	})

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
	checkbox.cacheArchives.addEventListener('change', event => toggleCacheArchives(event.target.checked))
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

	updateArchiveInput()
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
	if (!isNostra) return sendMessage('This functionality is disabled on this website, try doing this <a href="https://map.earthmc.net">here</a>.')
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