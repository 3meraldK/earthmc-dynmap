browser.runtime.onMessage.addListener(
	(data, sender) => {
		if (data.msg == 'alliance_error') document.body.insertAdjacentHTML('beforeend', `<span id="error-label" style="position: fixed;height: 50px;width: 250px;top: 50%;left: 50%;margin: -25px 0 0 -125px;text-align: center;background-color: #ffffff;z-index: 10000;color: black;font-size:22px;">Could not fetch latest alliances, try again soon.<button onclick="document.getElementById('error-label').remove()">OK</button></span>`);
		if (data.msg == 'fetching_archive') document.body.insertAdjacentHTML('beforeend', `<span id="wait-label" style="position: fixed;height: 50px;width: 250px;top: 50%;left: 50%;margin: -25px 0 0 -125px;text-align: center;background-color: #ffffff;z-index: 10000;color: black;font-size:22px;">Fetching archive, please wait.</span>`);
		if (data.msg == 'fetched_archive') document.getElementById('wait-label').remove();
		if (data.msg == 'condominium') {
			const interval = setInterval(() => {
				if (document.getElementsByTagName('svg')[0]) {
					clearInterval(interval);
					if (!document.getElementById(data.id)) {
						const condominium = `<pattern id="${data.id}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
						<rect class="checker" x="0" width="10" height="10" y="0" fill="${data.a}"/>
						<rect class="checker" x="10" width="10" height="10" y="10" fill="${data.a}"/>
						<rect class="checker" x="10" width="10" height="10" y="0" fill="${data.b}"/>
						<rect class="checker" x="0" width="10" height="10" y="10" fill="${data.b}"/>
						</pattern>`
						document.getElementsByTagName('svg')[0].insertAdjacentHTML('afterbegin', condominium);
					}
				}
			}, 1);
		}
		return false;
	}
);

if (!window.sessionStorage.getItem('mapMode')) window.sessionStorage.setItem('mapMode', 'meganations');
if (!window.sessionStorage.getItem('date')) window.sessionStorage.setItem('date', '0');

const interval = setInterval(() => {
	if (document.getElementsByClassName('compass compass_S compass_flat')[0] && document.getElementsByClassName('largeclock timeofday')[0]) {
		clearInterval(interval);
		document.getElementsByClassName('compass compass_S compass_flat')[0].remove();
		document.getElementsByClassName('largeclock timeofday')[0].remove();

		// Create menu.
		document.getElementsByClassName('leaflet-top leaflet-left')[0].insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control" style="display: grid"></div>`);
		const menu = document.getElementsByClassName('extension')[0];
		menu.insertAdjacentHTML('beforeend', `<div><abbr title="Switch between alliances and meganations. You may reload the page to get it work; otherwise, it is unavailable database or other unexpected error.">(?)</abbr> <button id="switch-button">Switch map mode</button></div>`);
		// Create the date input.
		const date = document.createElement('input');
		const archiveDiv = document.createElement('div');
		archiveDiv.innerHTML = '<abbr title="View old claims & stats, does not include terrain. Switch map mode to leave the archive. You may reload the page to get it work.">(?)</abbr> ';
		date.min = window.location.href.includes('nova') ? '2018-12-18' : '2022-05-01';
		date.max = new Date().toLocaleDateString('en-ca');
		date.type = 'date';
		date.style.width = '120px';
		archiveDiv.appendChild(date);
		menu.appendChild(archiveDiv);

		menu.insertAdjacentHTML('beforeend', `<div><abbr title="Search cities by name.">(?)</abbr> <input style="width: 60px" id="search-input"><button id="search-button">Search</button></div>`);
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
		document.getElementsByClassName('leaflet-top leaflet-left')[0].insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control" style="display: grid"><button class="collapsible">Open legend</button><div class="collapsible-content">${legend}</div></div>`);
		const rainbow = `background: linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(255,154,0,1) 10%, rgba(208,222,33,1) 20%, rgba(79,220,74,1) 30%, rgba(63,218,216,1) 40%, rgba(47,201,226,1) 50%, rgba(28,127,238,1) 60%, rgba(95,21,242,1) 70%, rgba(186,12,248,1) 80%, rgba(251,7,217,1) 90%, rgba(255,0,0,1) 100%)`;
		const checker = `background-image: linear-gradient(45deg, #000000 25%, transparent 25%), linear-gradient(-45deg, #000000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000000 75%), linear-gradient(-45deg, transparent 75%, #000000 75%);
		background-size: 6px 6px;
		background-position: 0 0, 0 3px, 3px -3px, -3px 0px`;
		document.head.insertAdjacentHTML('beforeend', `<style>
		.collapsible-content { display: none; }
		.box { float: left; height: 12px; width: 12px; margin-bottom: 2px; border: 2px solid black; clear: both; }
		.village { background-color: magenta; }
		.ruin { background-color: purple; }
		.default { ${rainbow}; border: 2px solid gray; }
		.premium { ${rainbow}; border: 2px solid lime; }
		.mega { ${rainbow}; height: 16px; width: 16px; border: 0px; }
		.alliance { ${rainbow}; height: 16px; width: 16px; border: 0px; }
		.condominium { ${checker}; border: 2px solid magenta; }
		</style>`);

		// Implement listeners.
		document.getElementsByClassName('collapsible')[0].addEventListener("click", function () {
			this.classList.toggle("active");
			const content = this.nextElementSibling;
			content.style.display = content.style.display == "block" ? "none" : "block";
		});
		document.getElementById('switch-button').addEventListener('click', () => {
			browser.runtime.sendMessage({ message: 'Button clicked' });
			window.sessionStorage.setItem('date', '0');
			window.sessionStorage.setItem('mapMode', window.sessionStorage.getItem('mapMode') == 'meganations' ? 'alliances' : 'meganations');
			document.location.reload();
		});
		date.addEventListener('change', () => {
			window.sessionStorage.setItem('date', date.valueAsDate.toLocaleDateString('sv').replaceAll('-', ''));
			window.sessionStorage.setItem('mapMode', 'archive');
			browser.runtime.sendMessage({ date: date.valueAsDate });
			document.location.reload();
		});
		document.getElementById('search-button').addEventListener('click', async () => {
			const server = window.location.href.split('/')[4];
			const markers = await fetch(`https://earthmc.net/map/${server}/tiles/_markers_/marker_earth.json`).then(res => res.json());
			for (const townArea of Object.values(markers.sets['townyPlugin.markerset'].areas)) {
				if (townArea.label.toLowerCase() == document.getElementById('search-input').value.toLowerCase()) {
					const x = townArea.x[0],
						z = townArea.z[0];
					window.location.href = `https://earthmc.net/map/${server}/?zoom=6&x=${x}&y=64&z=${z}`;
					break;
				}
			}
		});

		// Check for updates.
		fetch('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/chromium/manifest.json')
			.then(response => response.json())
			.then(manifest => {
				const localVersion = browser.runtime.getManifest().version;
				const latestVersion = manifest.version;
				if (localVersion == latestVersion) return;
				document.getElementsByClassName('leaflet-top leaflet-left')[0].insertAdjacentHTML('beforeend', `<div class="extension coord-control leaflet-control"><label><a href="https://github.com/3meraldK/earthmc-dynmap/releases/latest">Extension update available</a><br>(from ${localVersion} to ${latestVersion})</label></div>`);
			}).catch((error) => { console.log(`Could not fetch latest version: ${error}`); });
	}
}, 1000);