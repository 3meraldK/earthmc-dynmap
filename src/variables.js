/* variables.js - for variables that occur in almost every part of code */

const currentMapMode = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
const isNostra = !location.href.includes('aurora')
const apiURL = 'https://api.earthmc.net/v4'
const chosenArchiveDate = parseInt(localStorage['emcdynmapplus-archive-date'])

const { fetch: originalFetch } = typeof(unsafeWindow) != 'undefined' ? unsafeWindow : window
// Make this function work in userscript
if (typeof(unsafeWindow) != 'undefined') {
	unsafeWindow.lookupPlayerFunc = lookupPlayer
}
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