const interval = setInterval(() => {
	if (document.getElementsByClassName('coord-control coord-control-noy leaflet-control').length > 0) {
		// Page has been loaded; remove elements.
		document.getElementsByClassName('compass compass_S compass_flat')[0].remove();
		document.getElementsByClassName('largeclock timeofday')[0].remove();
		document.getElementsByClassName('leaflet-bottom leaflet-right')[0].remove();

		// Create map mode button.
		const div = document.createElement('div');
		div.className = 'coord-control leaflet-control';
		document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(div);
		const button = document.createElement('button');
		button.className = 'coord-control-button';
		button.innerHTML = 'Switch map mode';
		div.appendChild(button);

		// Detect the button click.
		button.addEventListener('click', () => {
			browser.runtime.sendMessage({message: 'Button clicked'});
			document.location.reload();
		});

		// Check for available update.
		fetch('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/firefox/manifest.json').then(response => response.json()).then(manifest => {
			const localVersion = chrome.runtime.getManifest().version;
			const latestVersion = manifest.version;
			if (localVersion != latestVersion) {
				// Create update available div.
				const div = document.createElement('div');
				div.className = 'coord-control leaflet-control';
				document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(div);
				const label = document.createElement('label');
				label.innerHTML = '<a href=\"https://github.com/3meraldK/earthmc-dynmap/releases/latest\">Extension update available</a><br>(from ' + localVersion + ' to ' + latestVersion + ')';
				div.appendChild(label);
			}
		}).catch(() => {});

		clearInterval(interval);
	}
}, 1000);