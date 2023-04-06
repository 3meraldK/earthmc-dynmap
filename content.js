// Constants used in the entire script.
const script = document.createElement('script'),
	browser = navigator.userAgent.includes('Chrome/') ? 'chromium' : 'firefox',
	baseURL = 'https://earthmc.net/map/',
	nationRegex = /(?<=\()[^)]*/,
	nationWikiRegex = /(?<=nofollow">)[^<]+(?=<\/a>\))/,
	endpointsURL = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/endpoints.json';

// Inject main.js.
script.src = chrome.runtime.getURL('main.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Wait for HTML elements to appear.
function waitFor(selector1, selector2) {
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

// Send alerts.
function sendAlert(message, error = null) {
	const alertMsgStyle =
	`position: absolute;
	height: 80px;
	width: 250px;
	top: 50%;
	left: 50%;
	text-align: center;
	background-color: #ffffff;
	color: black;
	font-size: 22px;
	margin-top: -40px;
	margin-left: -125px`;
	const button = `<button onclick="document.querySelector('#error-label').remove()">OK</button>`;
	document.body.insertAdjacentHTML('beforeend', `<span id="error-label" style="${alertMsgStyle}">${message}<br>${button}</span>`);
	if (error) console.log(message + `\n${error}`);
}

// Search for towns by name.
async function searchTown() {
	const map = location.href.split('/')[4];
	fetch(endpointsURL).then(response => response.json()).then(json => {
		fetch(json.markers.replace('{map}', map)).then(response => response.json()).then(markers => {
			for (const town of Object.values(markers.sets['townyPlugin.markerset'].areas)) {
				if (town.label.toLowerCase() !== document.querySelector('#search-input').value.toLowerCase()) continue;
				const avgX = (Math.min(...town.x) + Math.max(...town.x)) / 2;
				const avgZ = (Math.min(...town.z) + Math.max(...town.z)) / 2;
				location.href = `${baseURL}${map}/?zoom=6&x=${avgX}&y=64&z=${avgZ}`;
				return;
			}
			sendAlert('Could not find searched town.');
		}).catch((error) => sendAlert('Town dataset is currently unavailable, try again soon.', error));
	}).catch((error) => sendAlert('Could not fetch dataset of URLs, try again soon.', error));
}

// Search for nations by name.
async function searchNation() {
	const map = location.href.split('/')[4];
	fetch(endpointsURL).then(response => response.json()).then(json => {
		fetch(json.markers.replace('{map}', map)).then(res => res.json()).then(markers => {
			for (const town of Object.values(markers.sets['townyPlugin.markerset'].areas)) {
				nation = town.desc.includes('(<a ') ? town.desc.match(nationWikiRegex)[0] : town.desc.match(nationRegex)[0];
				if (document.querySelector('#nation-search-input').value.length <= 0
				|| nation.toLowerCase() !== document.querySelector('#nation-search-input').value.toLowerCase()
				|| !town.desc.includes('capital: true')) continue;
				const avgX = (Math.min(...town.x) + Math.max(...town.x)) / 2;
				const avgZ = (Math.min(...town.z) + Math.max(...town.z)) / 2;
				location.href = `${baseURL}${map}/?zoom=6&x=${avgX}&y=64&z=${avgZ}`;
				return;
			}
			sendAlert('Could not find searched nation.');
		}).catch((error) => sendAlert('Nation dataset is currently unavailable, try again soon.', error));
	}).catch(error => sendAlert('Could not fetch dataset of URLs, try again soon.', error));
}

if (!sessionStorage.getItem('mapMode')) sessionStorage.setItem('mapMode', 'meganations');
if (!sessionStorage.getItem('date')) sessionStorage.setItem('date', '0');

// Main function.
waitFor('.compass', '.largeclock').then(() => {
	document.querySelector('.compass').remove();
	document.querySelector('.largeclock').remove();

	// Create menu.
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control"
		style="display: grid"></div>`);
	const menu = document.querySelector('.extension');
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Switch between meganations, alliances and default map modes.">(?)</abbr>
		<button id="switch-button">Switch map mode</button></div>`);
	const minDate = location.href.includes('nova') ? '2018-12-18' : '2022-05-01';
	const maxDate = new Date().toLocaleDateString('en-ca');
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="View old claims & stats, does not include terrain. Switch map mode to leave this mode.">(?)</abbr>
		<input id="date" type="date" style="width: 120px" min="${minDate}" max="${maxDate}"></div>`);
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Search cities by name.">(?)</abbr> <input style="width: 60px" id="search-input"
		placeholder="London"><button id="search-button">Search</button></div>`);
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Search nations by name. It will set your view on its capital.">(?)</abbr>
		<input style="width: 60px" id="nation-search-input" placeholder="Germany"><button id="nation-search-button">Search</button></div>`);
	const dateInfo = sessionStorage.getItem('date') != '0' ? `, date: ${sessionStorage.getItem('date').replace(/(\d{4})(\d{2})(\d{2})/g, '$1-$2-$3')}` : '';
	menu.insertAdjacentHTML('beforeend', `<div>Showing: ${sessionStorage.getItem('mapMode')}${dateInfo}</div>`);

	// Create legend.
	const legend = `<b>Meganation</b><br>
	<div class='box village'></div> Nation-less town<br>
	<div class='box ruin'></div> Ruined town<br>
	<div class='box default'></div> Default nation<br>
	<div class='box premium'></div> Premium nation<br>
	<div class='box mega'></div> Mega-nation<br>
	<b>Other</b><br>
	<div class='box alliance'></div> Alliance<br>
	<div class='box condominium'></div> <abbr title="Two or more alliances.">(?)</abbr> Condominium`;
	const rainbow = `background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)`;
	const checker =
		`background-image: linear-gradient(45deg, #000000 25%, transparent 25%),
		linear-gradient(-45deg, #000000 25%, transparent 25%),
		linear-gradient(45deg, transparent 75%, #000000 75%),
		linear-gradient(-45deg, transparent 75%, #000000 75%);
		background-size: 6px 6px;
		background-position: 0 0, 0 3px, 3px -3px, -3px 0px`;

	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control"
		style="display: grid"><button class="collapsible">Open legend</button><div class="collapsible-content">${legend}</div></div>`);
	document.head.insertAdjacentHTML('beforeend', `<style>
	.collapsible-content { display: none; }
	.box { float: left; height: 12px; width: 12px; margin-bottom: 2px; border: 2px solid black; clear: both; }
	.village { background-color: magenta; border: 2px solid #a300a9; }
	.ruin { background-color: purple; border: 2px solid indigo; }
	.default { ${rainbow}; border: 2px solid #363636; }
	.premium { ${rainbow}; border: 2px solid #bfff00; }
	.mega { ${rainbow}; height: 16px; width: 16px; border: 0px; }
	.alliance { ${rainbow}; height: 16px; width: 16px; border: 0px; }
	.condominium { ${checker}; border: 2px solid magenta; }
	</style>`);

	// Collapsible legend.
	document.querySelector('.collapsible').addEventListener("click", function () {
		this.classList.toggle("active");
		const content = this.nextElementSibling;
		content.style.display = content.style.display === "block" ? "none" : "block";
	});

	// Switch map mode button.
	document.querySelector('#switch-button').addEventListener('click', () => {
		const mapMode = sessionStorage.getItem('mapMode');
		const mapMode1 = mapMode === 'meganations' ? 'alliances' : mapMode === 'alliances' ? 'default' : 'meganations';
		sessionStorage.setItem('date', '0');
		sessionStorage.setItem('mapMode', mapMode1);
		location.reload();
	});

	// Archives.
	document.querySelector('#date').addEventListener('change', () => {
		sessionStorage.setItem('date', document.querySelector('#date').valueAsDate.toLocaleDateString('sv').replaceAll('-', ''));
		sessionStorage.setItem('mapMode', 'archive');
		location.reload();
	});

	// Search city or nation.
	document.querySelector('#search-button').addEventListener('click', () => searchTown());
	document.querySelector('#search-input').addEventListener('keyup', (event) => { if (event.key === 'Enter') searchTown(); });
	document.querySelector('#nation-search-input').addEventListener('keyup', (event) => { if (event.key === 'Enter') searchNation(); });
	document.querySelector('#nation-search-button').addEventListener('click', () => searchNation());

	// Clickable player labels.
	const closeButton = `<button class="player-info-close" style="top: 5%; right: 5%; position: absolute; font-size: 8px"
		onclick="document.querySelector('.player-info').remove()">X</button>`;
	document.querySelector('.leaflet-pane.leaflet-marker-pane').addEventListener('click', function (event) {
		if (event.target.matches('.Marker.playerMarker.leaflet-marker-icon.leaflet-zoom-animated.leaflet-interactive span.playerNameSm.playerNameNoHealth')) {

			if (document.querySelector('.player-info')) document.querySelector('.player-info').remove();
			const playerInfo = `<div class="extension coord-control leaflet-control player-info" style="padding:20px 10px 5px 10px">Loading...${closeButton}</div>`;
			const map = location.href.split('/')[4];
			const player = event.target.innerText;
			document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', playerInfo)

			fetch(endpointsURL)
				.then(response => response.json())
				.then(json => {
					fetch(json.onlineplayers.replace('{map}', map).replace('{player}', player))
					.then(response => response.json())
					.then(data => {
						if (!data.town) document.querySelector('.player-info').innerHTML = `<b>${player}</b><br>Townless or could not<br>reach third-party source${closeButton}`;
						else document.querySelector('.player-info').innerHTML = `<b>${player}</b><br>Town: ${data.town}<br>Nation: ${data.nation}<br>Rank: ${data.rank}${closeButton}`
					}).catch(() => document.querySelector('.player-info').innerHTML = `<b>${player}</b><br>Could not reach third-party source${closeButton}`);
				}).catch((error) => sendAlert('Could not fetch dataset of URLs, try again soon.', error));
		}
	});

	// Check for updates.
	fetch(`https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/${browser}-manifest.json`)
		.then(response => response.json())
		.then(manifest => {

			const localVersion = chrome.runtime.getManifest().version;
			const latestVersion = manifest.version;
			if (localVersion === latestVersion) return;
			const releaseURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest';
			const updateMsg = `<div class="extension coord-control leaflet-control"><label><a href="${releaseURL}">
				Extension update available</a><br>(from ${localVersion} to ${latestVersion})</label></div>`;
			document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', updateMsg);

		}).catch((error) => { console.log(`Could not fetch latest version: ${error}`); });
});