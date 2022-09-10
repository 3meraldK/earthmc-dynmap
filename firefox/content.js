if (!window.sessionStorage.getItem('mapMode')) window.sessionStorage.setItem('mapMode', 'mega');
if (!window.sessionStorage.getItem('date')) window.sessionStorage.setItem('date', '0');

const interval = setInterval(() => {
	if (document.getElementsByClassName('coord-control coord-control-noy leaflet-control')) {
		// Page has been loaded; remove elements.
		clearInterval(interval);
		document.getElementsByClassName('compass compass_S compass_flat')[0].remove();
		document.getElementsByClassName('largeclock timeofday')[0].remove();

		// Create menu.
		const menu = document.createElement('div');
		menu.className = 'extension coord-control leaflet-control';
		document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(menu);
		menu.style.display = 'grid';

		// Create the button.
		const button = document.createElement('button');
		const buttonDiv = document.createElement('div');
		button.innerHTML = 'Switch map mode';
		buttonDiv.innerHTML = '<abbr title="Switch between alliances and meganations. You may reload the page to get it work; otherwise, it is unavailable database or other unexpected errors.">(?)</abbr> ';
		buttonDiv.appendChild(button);
		menu.appendChild(buttonDiv);

		// Create the date input.
		const date = document.createElement('input');
		const archiveDiv = document.createElement('div');
		archiveDiv.innerHTML = '<abbr title="View old claims & stats, does not include terrain. Switch map mode to leave the archive. You may reload the page to get it work.">(?)</abbr> ';
		date.min = window.location.href.includes('nova') ? '2018-12-18' : '2022-05-01';
		date.type = 'date';
		archiveDiv.appendChild(date);
		menu.appendChild(archiveDiv);

		// Create the label.
		const labelDiv = document.createElement('div');
		const dateInfo = window.sessionStorage.getItem('date') != '0' ? `, date: ${window.sessionStorage.getItem('date').replace(/(\d{4})(\d{2})(\d{2})/g, '$1-$2-$3')}` : '';
		labelDiv.innerHTML = `Mode: ${window.sessionStorage.getItem('mapMode')}${dateInfo}`;
		menu.appendChild(labelDiv);

		// Implement listeners.
		button.addEventListener('click', () => {
			browser.runtime.sendMessage({ message: 'Button clicked' });
			window.sessionStorage.setItem('date', '0');
			window.sessionStorage.setItem('mapMode', window.sessionStorage.getItem('mapMode') == 'mega' ? 'normal' : 'mega');
			document.location.reload();
		});
		date.addEventListener('change', () => {
			window.sessionStorage.setItem('date', date.valueAsDate.toLocaleDateString('sv').replaceAll('-', ''));
			window.sessionStorage.setItem('mapMode', 'archive');
			browser.runtime.sendMessage({ date: date.valueAsDate });
			document.location.reload();
		});

		// Check for updates.
		fetch('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/firefox/manifest.json')
			.then(response => response.json())
			.then(manifest => {
				const localVersion = browser.runtime.getManifest().version;
				const latestVersion = manifest.version;
				if (localVersion == latestVersion) return;

				const updateDiv = document.createElement('div');
				updateDiv.className = 'extension coord-control leaflet-control';
				document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(updateDiv);
				const updateLabel = document.createElement('label');
				updateLabel.innerHTML = `<a href="https://github.com/3meraldK/earthmc-dynmap/releases/latest">Extension update available</a><br>(from ${localVersion} to ${latestVersion})`;
				updateDiv.appendChild(updateLabel);
			}).catch((error) => { console.log(`Could not fetch latest version: ${error}`); });
	}
}, 1000);