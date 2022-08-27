const interval = setInterval(() => {
	if (document.getElementsByClassName('coord-control coord-control-noy leaflet-control')) {
		// Page has been loaded; remove elements.
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
		buttonDiv.innerHTML = '<abbr title="Switch between alliances and meganations. Restart page if dynmap did not load correctly, and check if database is down.">(?)</abbr> ';
		buttonDiv.appendChild(button);
		menu.appendChild(buttonDiv);

		// Create the date input.
		const date = document.createElement('input');
		const archiveDiv = document.createElement('div');
		archiveDiv.innerHTML = '<abbr title="View old claims & stats, does not include terrain. Switch map mode to leave the archive.">(?)</abbr> ';
		date.min = window.location.href.includes('nova') ? '2018-12-18' : '2022-05-01';
		date.type = 'date';
		archiveDiv.appendChild(date);
		menu.appendChild(archiveDiv);

		// Implement listeners.
		button.addEventListener('click', () => {
			browser.runtime.sendMessage({ message: 'Button clicked' });
			document.location.reload();
		});
		date.addEventListener('change', () => {
			browser.runtime.sendMessage({ date: date.valueAsDate });
			document.location.reload();
		});

		// Check for updates.
		fetch('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/firefox/manifest.json')
			.then(response => response.json())
			.then(manifest => {
				const localVersion = chrome.runtime.getManifest().version;
				const latestVersion = manifest.version;
				if (localVersion == latestVersion) return;

				const updateDiv = document.createElement('div');
				updateDiv.className = 'extension coord-control leaflet-control';
				document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(updateDiv);
				const updateLabel = document.createElement('label');
				updateLabel.innerHTML = `<a href="https://github.com/3meraldK/earthmc-dynmap/releases/latest">Extension update available</a><br>(from ${localVersion} to ${latestVersion})`;
				updateDiv.appendChild(updateLabel);
			}).catch((error) => { console.log(`Could not fetch latest version: ${error}`); });

		clearInterval(interval);
	}
}, 1000);