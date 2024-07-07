// ==UserScript==
// @name         EarthMC Dynmap+
// @version      1.14
// @description  Extension to enrich the EarthMC map experience
// @author       3meraldK
// @match        https://map.earthmc.net/*
// @iconURL      https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png
// ==/UserScript==

const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control" id="player-lookup"><span id="player-lookup-online" style="color:{online-color}">{online}</span><br><img id="player-lookup-avatar"/><center><b id="player-lookup-name">{player}</b>{about}</center><hr>Rank: <b>{rank}</b><br>Balance: <b>{balance} gold</b><br><span id="player-lookup-close">🗙</span></div>',
	partOf: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayerFunc(\'{player}\')">{player}</span>',
	residentList: '<span id="resident-list">\t{list}</span>',
	scrollableResidentList: '<div id="scrollable-resident-list">\t{list}</div>',
	sidebar: '<div id="emcdynmapplus-sidebar" class="leaflet-control-layers leaflet-control"></div>',
	updateNotification: '<div id="update-notification" class="leaflet-control-layers leaflet-control">EarthMC Dynmap+ update from {localVersion} to {latestVersion} is available. <a id="update-download-link" href="https://github.com/3meraldK/earthmc-dynmap/releases/latest">Click here to download!</a><br><span id="update-notification-close">🗙</span></div>',
	optionContainer: '<div class="option-container"></div>',
	locateTownInput: '<input class="sidebar-input" id="locate-town-input" placeholder="London">',
	locateTownButton: '<button class="sidebar-button" id="locate-town-button" type="submit">Locate town</button>',
	locateNationInput: '<input class="sidebar-input" id="locate-nation-input" placeholder="Germany">',
	locateNationButton: '<button class="sidebar-button" id="locate-nation-button" type="submit">Locate nation</button>',
	archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="2024-07-04" max="${new Date().toLocaleDateString('en-ca')}">`,
	archiveButton: '<button class="sidebar-button" id="archive-button" type="submit">Search archive</button>',
	switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>',
	alert: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>'
}

const { fetch: originalFetch } = unsafeWindow

// Both files

function sendAlert(message) {
	if (document.querySelector('#alert') != null) document.querySelector('#alert').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.alert)
	const alertMessage = document.querySelector('#alert-message')
	alertMessage.innerHTML = alertMessage.innerHTML.replace('{message}', message)
	document.querySelector('#alert-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

async function fetchJSON(url) {
	const response = await fetch(url)
	if (response.status == 404) return false
	else if (response.ok) return response.json()
	else return null
}

// content.js

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

	// Locate town button
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
	sidebar.insertAdjacentHTML('beforeend', htmlCode.switchMapMode)
	const switchMapModeButton = parent.querySelector('#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	// Current map mode label
	sidebar.insertAdjacentHTML('beforeend', htmlCode.optionContainer)
	const currentMapModeLabel = parent.querySelectorAll('.option-container')[3]
	const currentMapMode = localStorage.getItem('emcdynmapplus-mapmode') ?? 'meganations'
	currentMapModeLabel.style.fontSize = 'larger'
	currentMapModeLabel.style.boxSizing = 'border-box'
	currentMapModeLabel.style.padding = '5px'
	currentMapModeLabel.textContent = 'Current map mode: ' + currentMapMode
}

function switchMapMode() {
	const currentMapMode = localStorage.getItem('emcdynmapplus-mapmode')
	if (currentMapMode == 'meganations') {
		localStorage.setItem('emcdynmapplus-mapmode', 'alliances')
	}
	else if (currentMapMode == 'alliances') {
		localStorage.setItem('emcdynmapplus-mapmode', 'default')
	}
	else {
		localStorage.setItem('emcdynmapplus-mapmode', 'meganations')
	}
	location.reload()
}

function desaturateMap(elements) {
	elements.forEach(layer => { layer.style.filter = 'brightness(50%)' })
}

function init() {
	appendStyle()
	localStorage.setItem('emcdynmapplus-mapmode', localStorage.getItem('emcdynmapplus-mapmode') ?? 'meganations')

	waitForHTMLelement('div.leaflet-top.leaflet-left').then(element => {
		addMainMenu(element)
		checkForUpdate(element)
	})
	waitForHTMLelement('.leaflet-layer ', true).then(elements => desaturateMap(elements))
	waitForHTMLelement('#update-notification-close').then(element => {
		element.addEventListener('click', () => { element.parentElement.remove() })
	})
	// Fix nameplates appearing over popups
	waitForHTMLelement('.leaflet-pane.leaflet-nameplate-pane').then(element => element.style = '')
}

async function searchArchive(date) {
	if (date == '') return
	sendAlert('Fetching archive, please wait.')
	const URLDate = date.replaceAll('-', '')
	const markersURL = `https://web.archive.org/web/${URLDate}id_/https://map.earthmc.net/tiles/minecraft_overworld/markers.json`
	const archive = await fetchJSON('https://api.codetabs.com/v1/proxy/?quest=' + markersURL)
	if (!archive) return sendAlert('Archive service is currently unavailable, please try later.')
	localStorage.setItem('emcdynmapplus-archive', JSON.stringify(archive))
	localStorage.setItem('emcdynmapplus-mapmode', 'archive')
	location.reload()
}

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const data = await fetchJSON('https://api.earthmc.net/v3/aurora/towns?query=' + town)
	if (data == false) return sendAlert('The searched town has not been found.')
	if (data == null) return sendAlert('Service is currently unavailable, please try later.')

	const coords = { x: Math.round(data[0].coordinates.spawn.x), z: Math.round(data[0].coordinates.spawn.z) }
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	const nationData = await fetchJSON('https://api.earthmc.net/v3/aurora/nations?query=' + nation)
	if (nationData == false) return sendAlert('The searched nation has not been found.')
	if (nationData == null) return sendAlert('Service is currently unavailable, please try later.')

	const capital = nationData[0].capital.name
	const townData = await fetchJSON('https://api.earthmc.net/v3/aurora/towns?query=' + capital)
	if (townData == false) return sendAlert('Some unexpected error occurred while searching for nation, please try later.')
	if (townData == null) return sendAlert('Service is currently unavailable, please try later.')

	const coords = { x: Math.round(townData[0].coordinates.spawn.x), z: Math.round(townData[0].coordinates.spawn.z) }
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function checkForUpdate(parent) {
	const localVersion = GM_info.script.version
	const manifest = await fetchJSON('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/manifest.json')
	if (!manifest) return console.log('EarthMC Dynmap+ could not check for update.')
	const latestVersion = manifest.version
	if (latestVersion == localVersion) return
	parent.insertAdjacentHTML('beforeend', htmlCode.updateNotification)
	const updateNotification = parent.querySelector('#update-notification')
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{localVersion}', localVersion)
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{latestVersion}', latestVersion)
}

// main.js

let alliances = null
const currentMapMode = localStorage.getItem('emcdynmapplus-mapmode') ?? 'meganations'
if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)

function modifySettings(data) {
	data['player_tracker'].nameplates['show_heads'] = true
	data.zoom.def = 0
	// Set camera on Europe
	data.spawn.x = 2000
	data.spawn.z = -10000
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

	// Vertices need rounding to 16 because data has imprecise coordinates
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
        area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
    }

    return (Math.abs(area) / 2) / (16 * 16)
}

function modifyDescription(marker) {
	// Gather some information
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.at(1)
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)[1]
	let councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)[1].split(', ')
	councillors = councillors.filter(councillor => councillor != 'None')
	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)[1]
	const residentNum = residents.split(', ').length
	const wealth = marker.popup.match(/Wealth: <b>(\d+)G/)[1]
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null
	const nationAlliances = getNationAlliances(nation)

	// Calculate town's area
	let area = 0
	if (marker.type == 'polygon') {
		for (const region of marker.points) {
			const vertices = []
			for (const vertex of region[0]) { vertices.push(vertex) }
			area += getArea(vertices)
		}
	}

	// Modify resident list
	const residentList = residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorsList = councillors.map(councillor => htmlCode.residentClickable.replaceAll('{player}', councillor)).join(', ')
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, htmlCode.scrollableResidentList.replace('{list}', residentList))
	}
	else {
		marker.popup = marker.popup.replace(residents + '\n', htmlCode.residentList.replace('{list}', residentList) + '\n')
	}

	// Modify popup
	marker.popup = marker.popup
		.replace('</details>\n   \t<br>', '</details>') // Remove line break
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`) // Add size info
		.replace(/Wealth: <b>(\d+)G/, `Wealth: <b>${wealth} gold`) // Replace 'G' with 'gold'
		.replace('Wealth: <b>0 gold</b>\n\t<br>', '') // Remove 0 gold wealth info
		.replace('<i>/town set board [msg]</i>', '<i></i>') // Remove default town board
		.replace('<i></i> \n    <br>\n', '') // Remove empty town board
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
		.replace('Councillors: <b>None</b>\n\t<br>', '') // Remove none councillors info
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorsList}</b>`) // Lookup councillors
		.replace('Size: <b>0 chunks</b><br/>', '') // Remove 0 chunks town size info

	if (isCapital) marker.popup = marker.popup
		.replace('<span style="font-size:120%;">', '<span style="font-size:120%;">★ ') // Add capital star

	// Modify tooltip
	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')

	// Add part of label
	if (nationAlliances.length > 0) {
		const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
		const partOfLabel = htmlCode.partOf.replace('{allianceList}', allianceList)
		marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
	}

	return marker
}

function main(data) {
	if (currentMapMode == 'archive') {
		if (localStorage.getItem('emcdynmapplus-archive') == null) {
			sendAlert('Unexpected error occurred while setting the map mode to archive, maybe the service is unavailable? Try again later.')
		} else {
			const archive = localStorage.getItem('emcdynmapplus-archive')
			data = JSON.parse(archive)
		}
	}

	for (const index in data[0].markers) {
		let marker = data[0]['markers'][index]
		if (marker.type == null) continue

		marker = modifyDescription(marker)

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
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.at(1)
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)[1]
	const isRuin = (mayor.match(/NPC[0-9]+/) != null)
	const isNationless = (nation == null)
	const nationHasDefaultColor = (marker.color == '#3fb4ff' && marker.fillColor == '#3fb4ff') // Default blue
	const nationAlliances = getNationAlliances(nation)

	// Universal properties for the map modes
	if (currentMapMode == 'alliances') {
		marker.color = '#000000' // Black
		marker.fillColor = '#000000'
		marker.weight = 1
	} else {
		if (nationHasDefaultColor) {
			marker.color = '#363636' // Dark gray
			marker.fillColor = hashCode(nation)
		}
		if (!nationHasDefaultColor) marker.color = '#bfff00' // Default green
		if (isRuin) marker.fillColor = marker.color = '#7b00ff' // Violet
		if (isNationless) marker.fillColor = marker.color = '#ff00ff' // Magenta
	}

	// Properties for alliances
	if (nationAlliances.length == 0) return marker
	marker.weight = 1.5
	marker.fillColor = nationAlliances[0].colours.fill
	marker.color = nationAlliances[0].colours.outline
	if (nationAlliances.length < 2) return marker
	marker.opacity = 0

	return marker
}

// Make this function work in userscript
unsafeWindow.lookupPlayerFunc = lookupPlayer

async function lookupPlayer(player) {
	const data = await fetchJSON('https://api.earthmc.net/v3/aurora/players?query=' + player)
	if (data == false) return sendAlert('Unexpected error occurred while looking up the player, please try later.')
	if (data == null) return sendAlert('Service is currently unavailable, please try later.')

	if (document.querySelector('#player-lookup') != null) document.querySelector('#player-lookup').remove()
	document.querySelector('div.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', htmlCode.playerLookup)
	const lookup = document.querySelector('#player-lookup')

	const isOnline = data[0].status.isOnline
	const balance = data[0].stats.balance
	const about = (!data[0].about || data[0].about == '/res set about [msg]') ? '' : `<br><i>${data[0].about}</i>`
	let rank = 'Townless'
	if (data[0].status.hasTown) rank = 'Resident'
	if (data[0].ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (data[0].status.isMayor) rank = 'Mayor'
	if (data[0].ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (data[0].status.isKing) rank = 'Leader'

	const playerAvatarURL = 'https://mc-heads.net/avatar/' + data[0].uuid.replaceAll('-', '')
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player)
		.replace('{about}', about)
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{rank}', rank)
		.replace('{balance}', balance)

	document.querySelector('#player-lookup-close')
		.addEventListener('click', event => { event.target.parentElement.remove() })
}

async function getAlliances() {
	const alliances = await fetchJSON('https://emctoolkit.vercel.app/api/aurora/alliances')
	if (!alliances) {
		const cache = JSON.parse(localStorage.getItem('emcdynmapplus-alliances'))
		if (cache == null) {
			sendAlert('Service responsible for alliances is currently unavailable, please try later.')
			return []
		}
		sendAlert('Service responsible for alliances is currently unavailable - locally-saved alliance data has been loaded.')
		return cache
	}

	const finalArray = []
	for (const alliance of alliances) {
		let allianceType = alliance.type.toLowerCase() || 'mega'
		if (allianceType == 'sub') continue
		finalArray.push({
			name: alliance.fullName || alliance.allianceName,
			type: allianceType == 'mega' ? 'meganations' : 'alliances',
			nations: alliance.nations,
			colours: alliance.colours || { fill: '#000000', outline: '#000000' } // Black
		})
	}

	localStorage.setItem('emcdynmapplus-alliances', JSON.stringify(finalArray))
	return finalArray
}

// Replace the default fetch() with ours to intercept responses
unsafeWindow.fetch = async (...args) => {
    let [resource, config] = args
    let response = await originalFetch(resource, config)

	// Modify contents of markers.json and minecraft_overworld/settings.json
    if (response.url.includes('markers.json') || response.url.includes('minecraft_overworld/settings.json')) {

        const modifiedJson = await response.clone().json().then(data => {
			if (response.url.includes('markers.json')) data = main(data)
			if (response.url.includes('minecraft_overworld/settings.json')) data = modifySettings(data)
            return data
        })
        return new Response(JSON.stringify(modifiedJson))

    }

    return response
}

// style.css

function appendStyle() {
	const css = `
	/* Update notification */

	#update-notification {
		width: 150px;
		text-align: justify;
		font-size: larger;
		padding: 5px;
		box-sizing: border-box;
	}

	#update-download-link {
		font-weight: bold;
		text-decoration: none;
	}

	#update-notification-close {
		position: relative;
		left: 120px;
		cursor: pointer;
	}

	/* Player lookup */

	#player-lookup {
		width: 150px;
		text-align: justify;
		font-size: larger;
		padding: 5px;
		box-sizing: border-box;
	}

	#player-lookup-close {
		position: relative;
		left: 120px;
		cursor: pointer;
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

	/* Main sidebar */

	.option-container {
		width: 150px;
		display: flex;
	}

	.sidebar-input {
		width: 100%;
	}

	.sidebar-button {
		min-width: 75px;
	}

	/* Town popup */

	#scrollable-resident-list {
		overflow: auto;
		max-height: 200px;
		white-space: pre-wrap;
	}

	#resident-list {
		white-space: pre-wrap;
	}

	#part-of-label {
		font-size: 85%;
	}

	.resident-clickable:hover {
		background-color: #ddd;
		cursor: pointer;
	}

	/* Alert */

	#alert {
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
	}

	#alert-message {
		margin-block: 0;
		text-align: justify;
	}
	`

	const head = document.head || document.getElementsByTagName('head')[0]
	const style = document.createElement('style')
	head.appendChild(style)
	style.type = 'text/css'
	style.appendChild(document.createTextNode(css))
}

init()