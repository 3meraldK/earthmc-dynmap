const dataURL = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmapcolor/main/data.json';
const markerURL = 'https://earthmc.net/map/tiles/_markers_/marker_earth.json';

// Get meganations when extension starts and each 5 minutes.
function fetchMeganations() { fetch(dataURL).then(response => response.json()).then(data => meganations = data).catch(() => meganations = []) };
var meganations;
fetchMeganations();
setInterval(() => fetchMeganations(), 1000*60*5);

// Listens for request sending.
browser.webRequest.onBeforeRequest.addListener(
	onMapUpdate, 
	{urls: [markerURL]}, 
	['blocking']
);

// Function is fired when the request is sent.
function onMapUpdate(details) {

	// Decoding/encoding utilizations and StreamFilter object.
	const decoder = new TextDecoder('utf-8');
	const encoder = new TextEncoder();
	const filter = browser.webRequest.filterResponseData(details.requestId);

	// Get the response.
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}));

	// Fired when response is sent.
	filter.onstop = () => {

		// Decode the response.
		arrayBuffer.push(decoder.decode());
		const string = arrayBuffer.join('');
		const data = JSON.parse(string);

		// Check if response is undefined and delete star icons.
		if (data.sets === undefined) return;
		delete data.sets["townyPlugin.markerset"].markers;

		// Iterate through every town.
		Object.values(data.sets["townyPlugin.markerset"].areas).forEach(town => {

			// Settings for every town.
			town.weight = 1.6;
			town.opacity = 1;

			// Check if a town contains any (<text>) in their description.
			const townTitle = town.desc.match(/\([^ ]+\)/g);
			if (townTitle === null || townTitle === undefined || townTitle.length < 1) return;

			// Remove (Shop) from the description if existent.
			if (townTitle.indexOf('(Shop)') > -1) townTitle.splice(townTitle.indexOf('(Shop)'), 1);

			// Set every town's color to default.
			town.color = '#3FB4FF';
			town.fillcolor = '#3FB4FF';
			if (townTitle === null || townTitle === undefined || townTitle.length < 1) {
				town.color = '#89C500';
				town.fillcolor = '#89C500';
				return;
			};

			// Get rid of that array and brackets.
			const nation = townTitle[0].replace(/[()]/g, '');

			// Check if town's nation is in any meganation, if yes then apply colors and add a description.
			meganations.forEach(meganation => {

				if (!meganation.nations.includes(nation)) return;
				town.color = meganation.color;
				town.fillcolor = meganation.color;
				town.desc = town.desc.replace(')</span><br />', ')</span><br /> ' + 
					'<span style=\"font-size:80%\">Part of</span> ' + 
					'<span style=\"font-size:90%\"><b>' + meganation.name + '</b></span><br />');
			});

		});

		// Send the modified response and close the filter.
		filter.write(encoder.encode(JSON.stringify(data)));
		filter.close();
	};
}