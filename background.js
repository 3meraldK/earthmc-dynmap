const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

// Get meganations when extension starts and each 5 minutes.
function fetchNovaAlliances() { fetch('https://raw.githubusercontent.com/3meraldK/earthmc-dynmapcolor/main/data-nova.json').then(response => response.json()).then(data => novaAlliances = data).catch(() => novaAlliances = []) };
function fetchAuroraAlliances() { fetch('https://raw.githubusercontent.com/3meraldK/earthmc-dynmapcolor/main/data-aurora.json').then(response => response.json()).then(data => auroraAlliances = data).catch(() => auroraAlliances = []) };
var novaAlliances, auroraAlliances, meganations;
fetchAuroraAlliances();
fetchNovaAlliances();
setInterval(() => {
	fetchAuroraAlliances();
	fetchNovaAlliances();
}, 1000*60*5);

// Listens for requests.
browser.webRequest.onBeforeRequest.addListener(
	function listener(details) { details.url.includes('up/world/earth/') ? onPlayerUpdate(details) : onMapUpdate(details); }, 
	{urls: ['https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json', 'https://earthmc.net/map/nova/up/world/earth/*', 'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json', 'https://earthmc.net/map/aurora/up/world/earth/*']}, 
	['blocking']
);

// Function is fired when the marker_earth request is sent.
function onMapUpdate(details) {
	var usedMap;
	if (details.url.includes('nova')) usedMap = 'nova';
	else if (details.url.includes('aurora')) usedMap = 'aurora';
	const filter = browser.webRequest.filterResponseData(details.requestId);

	// Get the response.
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}));

	// Fired when response is sent.
	filter.onstop = () => {

		// Decode the response.
		arrayBuffer.push(decoder.decode());
		const data = JSON.parse(arrayBuffer.join(''));

		// Check if response is undefined and delete star icons.
		if (data.sets === undefined) return;
		delete data.sets["townyPlugin.markerset"].markers;

		// Iterate through every town.
		Object.values(data.sets["townyPlugin.markerset"].areas).forEach(town => {

			// Settings for every town.
			town.weight = 1.6;
			town.opacity = 1;

			townTitle = town.desc.split('<br \/>')[0];
			townTitle = townTitle.replace(/\(Shop\)$/g, '').replaceAll(/[()]/g, '').split(' ');
			const nation = townTitle[2].toLowerCase().replace('</span>', '');

			// Set every town's color to default.
			town.color = '#3FB4FF';
			town.fillcolor = '#3FB4FF';
			if (nation.length < 1) {
				town.color = '#89C500';
				town.fillcolor = '#89C500';
				return;
			};

			// Get rid of an array and brackets.
			var meganationList = '';

			// Check if town's nation is in any meganation.
			if (usedMap == 'nova') meganations = novaAlliances;
			else if (usedMap == 'aurora') meganations = auroraAlliances;
			meganations.forEach(meganation => {
				if (meganation.type != 'meganation') return;
				// Nation controlled by multiple meganations support.
				if (!meganation.nations.includes(nation)) return;
				if (meganationList.length < 1) meganationList += meganation.name;
				else meganationList += ', ' + meganation.name;

				// If yes, apply fill color (and stroke color if defined).
				const fillColor = meganation.color[0];
				var strokeColor = fillColor;
				if (meganation.color.length == 2) strokeColor = meganation.color[1];
				town.color = strokeColor;
				town.fillcolor = fillColor;
			});
				
			// Apply description.
			if (meganationList.length > 0) town.desc = town.desc.replace(')</span><br />', ')</span><br /> ' + 
				'<span style=\"font-size:80%\">Part of</span> ' + 
				'<span style=\"font-size:90%\"><b>' + meganationList + '</b></span><br />');
		});

		// Send the modified response and close the filter.
		console.log('Response was modified and sent');
		filter.write(encoder.encode(JSON.stringify(data)));
		filter.close();
	};
}

// Fired each ~1 second when the update request is sent.
function onPlayerUpdate(details) {
	const filter = browser.webRequest.filterResponseData(details.requestId);
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}));

	filter.onstop = () => {
		arrayBuffer.push(decoder.decode());
		const string = arrayBuffer.join('');
		const data = JSON.parse(string);

		// If response's length > 32 kB then trigger onMapUpdate(), otherwise write data to the filter
		if (!data.currentcount) return;
		if (string.length < 32768) filter.write(encoder.encode(JSON.stringify(data)));
		else onMapUpdate(details);
		filter.close();
	};
}