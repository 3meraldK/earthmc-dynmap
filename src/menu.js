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
		cacheArchives: addOption(i++, 'cache-archives', `<abbr title="Save archive mode snapshots in your browser's Origin Private File System for its instant load upon next time. One cache weighs a few MBs.">Cache archives</abbr>`, 'cache-archives'),
	}

	// Archive mode world
	const archiveModeWorld = addElement(optionsMenu, htmlCode.options.option, '.option', true)[i++]
	archiveModeWorld.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', 'archive-mode-world')
		.replace('{optionName}', '<abbr title="Load archived townchunks snapshots from the selected world. Towns will only be properly overlayed in Terra Nostra snapshots.">Archive mode world</abbr>'))
	archiveModeWorld.style.display = 'unset'
	const select = addElement(archiveModeWorld, htmlCode.options.archiveWorldMode, '#archive-mode-world')
	select.addEventListener('change', event => {
		localStorage['emcdynmapplus-archive-mode-world'] = select.value
		updateArchiveInput()
	})

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
	checkbox.cacheArchives.addEventListener('change', event => toggleCacheArchives(event.target.checked))

	updateArchiveInput()
}

const worldDates = {
	'Classic': { min: '2017-09-06', max: '2018-07-07' },
	'Terra Nova': { min: '2018-12-17', max: '2024-06-17' },
	'Terra Aurora': { min: '2022-05-01', max: '2026-04-12' },
	'Terra Nostra': { min: '2026-04-17', max: new Date().toLocaleDateString('en-ca') }
}
function updateArchiveInput() {
	const archiveModeWorldVariable = localStorage['emcdynmapplus-archive-mode-world'] ?? 'Terra Nostra'
	const archiveInput = document.querySelector('#archive-input')
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