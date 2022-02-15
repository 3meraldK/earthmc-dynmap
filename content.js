const interval = setInterval(() => {
	if (document.getElementsByClassName('playerNameSm playerNameNoHealth').length > 0) {
		document.getElementsByClassName('compass compass_S compass_flat')[0].remove();
		document.getElementsByClassName('largeclock timeofday')[0].remove();
		document.getElementsByClassName('leaflet-bottom leaflet-right')[0].remove();
		clearInterval(interval);
	}
}, 1000);