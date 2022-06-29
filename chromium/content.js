// Check if database is available.
let fetchFailure;
fetch('https://earthmc-api.herokuapp.com/api/v1/nova/onlineplayers')
    .then(response => { 
		if (response.ok || response.status == 304) {chrome.runtime.sendMessage({message: 'Database fetched'}); fetchFailure = false;} 
		else {chrome.runtime.sendMessage({message: 'Database error'}); fetchFailure = true;}})
    .catch(() => {chrome.runtime.sendMessage({message: 'Database error'}); fetchFailure = true;});

const interval = setInterval(() => {
	if (document.getElementsByClassName('coord-control coord-control-noy leaflet-control').length > 0 && fetchFailure != undefined) {
		// Dynmap has been loaded fully; remove elements.
		document.getElementsByClassName('compass compass_S compass_flat')[0].remove();
		document.getElementsByClassName('largeclock timeofday')[0].remove();
		document.getElementsByClassName('leaflet-bottom leaflet-right')[0].remove();

		// Create map mode switch button.
		const coordControl = document.createElement('div');
		coordControl.className = 'coord-control leaflet-control';
		document.getElementsByClassName('leaflet-top leaflet-left')[0].appendChild(coordControl);
		const button = document.createElement('button');
		button.className = 'coord-control-button';
		!fetchFailure ? button.innerHTML = 'Switch map mode' : button.innerHTML = 'Database error, try later';
		coordControl.appendChild(button);

		// Add event listener.
		button.addEventListener('click', () => {
			chrome.runtime.sendMessage({message: 'Button clicked'});
			document.location.reload();
		});

		clearInterval(interval);
	}
}, 1000);


