// ==UserScript==
// @name         EarthMC Dynmap+
// @version      1.13
// @description  Extension to enrich the EarthMC Dynmap experience
// @author       3meraldK
// @match        https://earthmc.net/map/*
// @iconURL      https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png
// ==/UserScript==

const repo = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap',
	endpointsURL = `${repo}/main/endpoints.json`,
	playerLabelClass = 'span.playerNameNoHealth',
	sidebarClass = 'emcdynmap coord-control leaflet-control';

function injectMainScript() {
	const mainScript = document.createElement('script');
	mainScript.src = 'https://cdn.jsdelivr.net/gh/3meraldK/earthmc-dynmap@1.13/main.js';
	mainScript.onload = function () { this.remove(); };
	(document.head || document.documentElement).appendChild(mainScript);
	(document.head || document.documentElement).insertAdjacentHTML('beforeend',
        '<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/3meraldK/earthmc-dynmap@1.13/style.css" />')
}

function loadDarkMode() {
	document.head.insertAdjacentHTML('beforeend',
	`<style id="dark-mode">
		.leaflet-control,
		.leaflet-popup-content-wrapper,
		.leaflet-control-zoom > a,
		.leaflet-control button,
		.leaflet-control input,
		.leaflet-popup-tip {
			background: #111 !important;
			color: #bbb !important;
			box-shadow: inset 0 0 0 1px #bbb !important;
		}
	</style>`
	);
}

function waitForHTMLelems(selector1, selector2) {
    return new Promise(resolve => {
        if (document.querySelector(selector1) && document.querySelector(selector2)) {
            return resolve([document.querySelector(selector1), document.querySelector(selector2)]);
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector1) && document.querySelector(selector2)) {
                resolve([document.querySelector(selector1), document.querySelector(selector2)]);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function sendAlert(message, error = null) {
	const button = `<button onclick="document.getElementById('error-label').remove()">OK</button>`;
	document.body.insertAdjacentHTML('beforeend', `<span id="error-label">${message}<br>${button}</span>`);
	if (error) console.log(message + `\n${error}`);
}

async function search(searchWhat) {
	const inputValue = document.getElementById(`${searchWhat}-search-input`).value;
	const inputLength = inputValue.length;
	if (!inputLength) return;
	const map = location.href.split('/')[4];

	const markersURL = await fetch(endpointsURL)
		.then(resp => resp.json())
		.then(json => json.markers.replace('{map}', map))
		.catch(() => {
			sendAlert(`Couldn't get needed data, try again later.`, `Attempted to fetch data from: ${endpointsURL}`);
			return;
		});
	const markers = await fetch(markersURL)
		.then(resp => resp.json())
		.then(json => json.sets['townyPlugin.markerset'].areas)
		.catch(() => {
			sendAlert(`Couldn't get needed data, try again later.`, `Attempted to fetch data from: ${endpointsURL}`);
			return;
		});

	const town = Object.values(markers).find(town => {
		const {desc, label} = town;
		if (searchWhat === 'nation') {
			const nation = getNation(desc);
			return nation.toLowerCase() === inputValue.toLowerCase() && desc.includes('capital: true');
		} else return label.toLowerCase() === inputValue.toLowerCase();
	});
	if (town) {
		const avgX = (Math.min(...town.x) + Math.max(...town.x)) / 2;
		const avgZ = (Math.min(...town.z) + Math.max(...town.z)) / 2;
		location.href = `https://earthmc.net/map/${map}/?zoom=6&x=${avgX}&z=${avgZ}`;
		return;
	}
	sendAlert(`Couldn't find searched ${searchWhat}.`);
}

function getNation(desc) {
	const nationWikiRegex = /(?<=nofollow">)[^<]+(?=<\/a>\))/;
	const nationRegex = /(?<=\()[^)]*/;
	if (desc.includes('(<a ')) return desc.match(nationWikiRegex)[0];
	else return desc.match(nationRegex)[0];
}

function addDarkMode() {
	if (localStorage.getItem('emcdynmap-darkmode')) loadDarkMode();

	// Dark mode button & listener
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="${sidebarClass}"
		style="display: grid"><button id="dark-mode-button">Dark mode</button></div>`);
	document.getElementById('dark-mode-button').addEventListener("click", function () {
		if (localStorage.getItem('emcdynmap-darkmode')) {
			localStorage.removeItem('emcdynmap-darkmode');
			document.getElementById('dark-mode').remove();
		} else {
			localStorage.setItem('emcdynmap-darkmode', 1);
			loadDarkMode();
		}
	});
}

function addMainMenu() {
	// Main box
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="${sidebarClass}"
		style="display: grid"></div>`);
	const menu = document.querySelector('.emcdynmap');

	// Switch map mode button
	const mapModeHint = 'Switch between meganations, alliances and default map modes.';
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="${mapModeHint}">(?)</abbr>
	<button id="switch-button">Switch map mode</button></div>`);
	document.getElementById('switch-button').addEventListener('click', () => {
		let mapMode = sessionStorage.getItem('emcdynmap-mapMode') || 'meganations';
		mapMode = (mapMode === 'meganations') ? 'alliances' : (mapMode === 'alliances') ? 'default' : 'meganations';
		sessionStorage.setItem('emcdynmap-date', '0');
		sessionStorage.setItem('emcdynmap-mapMode', mapMode);
		location.reload();
	});

	// The archive input
	const minDate = (location.href.includes('nova')) ? '2018-12-18' : '2022-05-01',
		maxDate = new Date().toLocaleDateString('en-ca'),
		archiveHint = 'View old claims & stats, does not include terrain. Switch map mode to leave this mode.';
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="${archiveHint}">(?)</abbr>
		<input id="date" type="date" style="width: 120px" min="${minDate}" max="${maxDate}"></div>`);
	const dateInput = document.getElementById('date');
	dateInput.addEventListener('change', () => {
		const unformattedDate = dateInput.valueAsDate.toLocaleDateString('sv').replaceAll('-', '');
		sessionStorage.setItem('emcdynmap-date', unformattedDate);
		sessionStorage.setItem('emcdynmap-mapMode', 'archive');
		location.reload();
	});

	// Search town/nation
	const searchNationHint = 'Search nations by name. It will set your view on its capital.';
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Search cities by name.">(?)</abbr>
		<input id="town-search-input" placeholder="London"><button id="town-search-button">Search</button></div>`);
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="${searchNationHint}">(?)</abbr>
		<input id="nation-search-input" placeholder="Germany"><button id="nation-search-button">Search</button></div>`);
	['town', 'nation'].forEach(elem => {
		const button = document.getElementById(`${elem}-search-button`);
		const input = document.getElementById(`${elem}-search-input`);
		button.addEventListener('click', () => search(elem));
		input.addEventListener('keyup', (event) => { if (event.key === 'Enter') search(elem) });
	})

	// Current map mode and date
	const date = sessionStorage.getItem('emcdynmap-date') || '0',
		formattedDate = date.replace(/(\d{4})(\d{2})(\d{2})/g, '$1-$2-$3'),
		dateInfo = (date !== '0') ? `, date: ${formattedDate}` : '',
		mapMode = sessionStorage.getItem('emcdynmap-mapMode') || 'meganations';
	menu.insertAdjacentHTML('beforeend', `<div>Showing: ${mapMode}${dateInfo}</div>`);
}

function checkForUpdates() {
	fetch(`${repo}/main/manifest.json`)
		.then(response => response.json())
		.then(manifest => {
			const localVersion = chrome.runtime.getManifest().version;
			if (localVersion === manifest.version) return;
			const releaseURL = `https://github.com/3meraldK/earthmc-dynmap/releases/latest`;
			const updateMsg = `<div class="${sidebarClass}"><a href="${releaseURL}" target="_blank">
				Extension update available</a><br>(from ${localVersion} to ${manifest.version})</div>`;
			document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', updateMsg);
		}).catch(() => console.log(`EarthMC Dynmap+ couldn't get latest release version.`));
}

function addPlayerLookup() {
	const playerLabels = document.querySelector('.leaflet-pane');

	// Hovering over usernames
	playerLabels.addEventListener('mouseover', function (event) {
		if (event.target.matches(playerLabelClass)) event.target.style = 'background: rgba(55, 55, 55, 0.6); cursor: default';
	})
	playerLabels.addEventListener('mouseout', function (event) {
		if (event.target.matches(playerLabelClass)) event.target.style.background = 'rgba(0, 0, 0, 0.6)';
	})

	// Clicking usernames
	const closeButton = `<button id="player-info-close"
		onclick="document.getElementById('player-info').remove()">X</button>`;
	playerLabels.addEventListener('click', async function (event) {
		if (event.target.matches(playerLabelClass)) {

			let playerLookupElem = document.getElementById('player-info');
			if (playerLookupElem) playerLookupElem.remove();
			const playerLookupHTML = `<div class="${sidebarClass}" id="player-info">Loading...${closeButton}</div>`,
				map = location.href.split('/')[4],
				player = event.target.innerText,
				faceImg = `https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=faces/16x16/${player}.png`;
			const beginning = `<img src="${faceImg}" id="player-face"/><br><b>${player}</b><br>`;
			let playerStatus = `Townless`;
			document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', playerLookupHTML)
			playerLookupElem = document.getElementById('player-info');

			const onlinePlayersURL = await fetch(endpointsURL)
				.then(resp => resp.json())
				.then(json => json.onlineplayers.replace('{map}', map).replace('{player}', player))
				.catch(() => {
					sendAlert(`Couldn't get list of players, try again later.`, `Attempted to fetch data from: ${endpointsURL}`);
					return;
				});
			const playerData = await fetch(onlinePlayersURL)
				.then(resp => resp.json())
				.catch(() => {
					playerLookupElem.innerHTML = `${beginning}Couldn't get player info, try again later.${closeButton}`;
					return;
				});

			if (playerData.town) playerStatus = 
				`Town: ${playerData.town}<br>
				Nation: ${playerData.nation}<br>
				Rank: ${playerData.rank}`;
			playerLookupElem.innerHTML = `${beginning}${playerStatus}${closeButton}`;
		}
	});
}

function addLegend() {
	const hint = `<abbr title="Land shared between two or more alliances/meganations.">(?)</abbr>`,
		legend =
		`<div class="box" id="nationless"></div> Nation-less town<br>
		<div class="box" id="ruin"></div> Ruined town<br>
		<div class="box" id="default"></div> Default nation<br>
		<div class="box" id="premium"></div> Custom-colored nation<br>
		<div class="box" id="meganation"></div> Mega-nation<br>
		<div class="box" id="alliance"></div> Alliance<br>
		<div class="box" id="condominium"></div> ${hint} Condominium`;

	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="${sidebarClass}"
		style="display: grid"><button id="collapsible">Open legend</button><div id="collapsible-content">${legend}</div></div>`);

	document.getElementById('collapsible').addEventListener("click", function () {
		this.classList.toggle("active");
		const content = this.nextElementSibling;
		content.style.display = (content.style.display === "block") ? "none" : "block";
	});
}

(function() {
    'use strict';
    injectMainScript();
    waitForHTMLelems('.compass', '.largeclock').then(() => {
        document.querySelector('.compass').remove();
        document.querySelector('.largeclock').remove();
        addMainMenu()
        addLegend()
        addPlayerLookup()
        addDarkMode()
        checkForUpdates()
    });
})();