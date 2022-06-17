const interval = setInterval(() => {
	if (document.getElementsByClassName('coord-control coord-control-noy leaflet-control').length > 0) {
		// Page has been loaded; remove elements.
		document.getElementsByClassName('compass compass_S compass_flat')[0].remove();
		document.getElementsByClassName('largeclock timeofday')[0].remove();
		document.getElementsByClassName('leaflet-bottom leaflet-right')[0].remove();

		// Create map mode button.
		const coordControl = document.createElement('div');
		coordControl.className = 'coord-control leaflet-control';
		document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(coordControl);
		const button = document.createElement('button');
		button.className = 'coord-control-button';
		button.innerHTML = 'Switch map mode';
		coordControl.appendChild(button);

		// Detect the button click.
		button.addEventListener('click', () => {
			browser.runtime.sendMessage({message: 'Button clicked'});
			document.location.reload();
		});

		clearInterval(interval);
	}
}, 1000);


