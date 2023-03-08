const script = document.createElement('script'),
	browsing = navigator.userAgent.indexOf("Gecko/") === -1 ? 'chromium' : 'firefox';
script.src = chrome.runtime.getURL('main.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);
if (!window.sessionStorage.getItem('mapMode')) window.sessionStorage.setItem('mapMode', 'meganations');
if (!window.sessionStorage.getItem('date')) window.sessionStorage.setItem('date', '0');

// Courtesy of Yong Wang
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

async function searchTown() {
	const server = window.location.href.split('/')[4];
	fetch(`https://earthmc.net/map/${server}/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`)
		.then(response => response.json())
		.then(data => {
			for (const townArea of Object.values(data.sets['townyPlugin.markerset'].areas)) {
				if (townArea.label.toLowerCase() === document.querySelector('#search-input').value.toLowerCase()) {
					const avgX = (Math.min(...townArea.x) + Math.max(...townArea.x)) / 2,
						avgZ = (Math.min(...townArea.z) + Math.max(...townArea.z)) / 2;
					window.location.href = `https://earthmc.net/map/${server}/?zoom=6&x=${avgX}&y=64&z=${avgZ}`;
					break;
				}
			}
		}).catch(error => console.log(`Could not fetch marker_json: ${error}`));

}

async function searchNation() {
	const server = window.location.href.split('/')[4];
	fetch(`https://earthmc.net/map/${server}/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`)
		.then(res => res.json())
		.then(data => {
			for (const townArea of Object.values(data.sets['townyPlugin.markerset'].areas)) {
				const nation = !townArea.desc.includes('"nofollow">') ? townArea.desc.split(' (')[1].split(')')[0] : townArea.desc.split('"nofollow">')[1].split('</a>)')[0];
				if (document.querySelector('#nation-search-input').value.length > 0 && nation.toLowerCase() === document.querySelector('#nation-search-input').value.toLowerCase() && townArea.desc.includes('capital: true')) {
					const avgX = (Math.min(...townArea.x) + Math.max(...townArea.x)) / 2,
						avgZ = (Math.min(...townArea.z) + Math.max(...townArea.z)) / 2;
					window.location.href = `https://earthmc.net/map/${server}/?zoom=6&x=${avgX}&y=64&z=${avgZ}`;
					break;
				}
			}
		}).catch(error => console.log(`Could not fetch marker_json: ${error}`));;

}

waitFor('.compass', '.largeclock').then(() => {
	document.querySelector('.compass').remove();
	document.querySelector('.largeclock').remove();

	// Create menu.
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control" style="display: grid"></div>`);
	const menu = document.querySelector('.extension');
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Switch between meganations, alliances and default map modes.">(?)</abbr> <button id="switch-button">Switch map mode</button></div>`);
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="View old claims & stats, does not include terrain. Switch map mode to leave the archive.">(?)</abbr> <input id="date" type="date" style="width: 120px" min="${window.location.href.includes('nova') ? '2018-12-18' : '2022-05-01'}" max="${new Date().toLocaleDateString('en-ca')}"></div>`);
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Search cities by name.">(?)</abbr> <input style="width: 60px" id="search-input" placeholder="London"><button id="search-button">Search</button></div>`);
	menu.insertAdjacentHTML('beforeend', `<div><abbr title="Search nations by name. It will set your view on its capital.">(?)</abbr> <input style="width: 60px" id="nation-search-input" placeholder="Germany"><button id="nation-search-button">Search</button></div>`);
	const dateInfo = window.sessionStorage.getItem('date') != '0' ? `, date: ${window.sessionStorage.getItem('date').replace(/(\d{4})(\d{2})(\d{2})/g, '$1-$2-$3')}` : '';
	menu.insertAdjacentHTML('beforeend', `<div>Showing: ${window.sessionStorage.getItem('mapMode')}${dateInfo}</div>`);

	// Create legend.
	const legend = `<b>Meganation</b><br>
	<div class='box village'></div> Nation-less town<br>
	<div class='box ruin'></div> Ruined town<br>
	<div class='box default'></div> Default nation<br>
	<div class='box premium'></div> Premium nation<br>
	<div class='box mega'></div> Mega-nation<br>
	<b>Other</b><br>
	<div class='box alliance'></div> Alliance<br>
	<div class='box condominium'></div> Condominium`;
	document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control" style="display: grid"><button class="collapsible">Open legend</button><div class="collapsible-content">${legend}</div></div>`);
	const rainbow = `background: linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(255,154,0,1) 10%, rgba(208,222,33,1) 20%, rgba(79,220,74,1) 30%, rgba(63,218,216,1) 40%, rgba(47,201,226,1) 50%, rgba(28,127,238,1) 60%, rgba(95,21,242,1) 70%, rgba(186,12,248,1) 80%, rgba(251,7,217,1) 90%, rgba(255,0,0,1) 100%)`;
	const checker = `background-image: linear-gradient(45deg, #000000 25%, transparent 25%), linear-gradient(-45deg, #000000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000000 75%), linear-gradient(-45deg, transparent 75%, #000000 75%);
	background-size: 6px 6px;
	background-position: 0 0, 0 3px, 3px -3px, -3px 0px`;
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
		const mapMode = window.sessionStorage.getItem('mapMode'),
			newMapMode = mapMode === 'meganations' ? 'alliances' : mapMode === 'alliances' ? 'default' : 'meganations';
		window.sessionStorage.setItem('date', '0');
		window.sessionStorage.setItem('mapMode', newMapMode);
		document.location.reload();
	});

	// Archives.
	document.querySelector('#date').addEventListener('change', () => {
		window.sessionStorage.setItem('date', document.querySelector('#date').valueAsDate.toLocaleDateString('sv').replaceAll('-', ''));
		window.sessionStorage.setItem('mapMode', 'archive');
		document.location.reload();
	});

	// Search city or nation.
	document.querySelector('#search-button').addEventListener('click', () => searchTown());
	document.querySelector('#search-input').addEventListener('keyup', (event) => { if (event.key === 'Enter') searchTown(); });
	document.querySelector('#nation-search-input').addEventListener('keyup', (event) => { if (event.key === 'Enter') searchNation(); });
	document.querySelector('#nation-search-button').addEventListener('click', () => searchNation());

	// Clickable player labels.
	const closeButton = `<button class="player-info-close" style="top:5%;right:5%;position:absolute;font-size:8px;" onclick="document.querySelector('.player-info').remove()">X</button>`;
	document.querySelector('.leaflet-pane.leaflet-marker-pane').addEventListener('click', function (e) {
		if (e.target.matches('.Marker.playerMarker.leaflet-marker-icon.leaflet-zoom-animated.leaflet-interactive span.playerNameSm.playerNameNoHealth')) {
			if (document.querySelector('.player-info')) document.querySelector('.player-info').remove();
			document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control player-info" style="padding:20px 10px 5px 10px;">Loading...${closeButton}</div>`)
			const server = window.location.href.split('/')[4];
			fetch(`https://emctoolkit.vercel.app/api/${server}/onlineplayers/${e.target.innerText}`)
				.then(response => response.json())
				.then(data => {
					if (!data.town) document.querySelector('.player-info').innerHTML = `<b>${e.target.innerText}</b><br>Townless / could not reach third-party API${closeButton}`;
					else {
						const town = data.town,
							nation = data.nation,
							rank = data.rank;
						document.querySelector('.player-info').innerHTML = `<b>${e.target.innerText}</b><br>Town: ${town}<br>Nation: ${nation}<br>Rank: ${rank}${closeButton}`
					}
				}).catch((error) => {
					console.log(`Could not fetch player info: ${error}`);
					document.querySelector('.player-info').innerHTML = `<b>${e.target.innerText}</b><br>Could not reach third-party API${closeButton}`;
				});
		}
	});

	// Check for updates.
	fetch(`https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/${browsing}-manifest.json`)
		.then(response => response.json())
		.then(manifest => {
			const localVersion = chrome.runtime.getManifest().version,
				latestVersion = manifest.version;
			if (localVersion === latestVersion) return;
			document.querySelector('.leaflet-top.leaflet-left').insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control"><label><a href="https://github.com/3meraldK/earthmc-dynmap/releases/latest">Extension update available</a><br>(from ${localVersion} to ${latestVersion})</label></div>`);
		}).catch((error) => { console.log(`Could not fetch latest version: ${error}`); });
});