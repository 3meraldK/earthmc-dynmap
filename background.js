const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const novaURL = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmapcolor/main/data-nova.json';
const auroraURL = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmapcolor/main/data-aurora.json';
const fetchAlliances = (map) => fetch(map).then(res => res.json()).catch(() => {});
const buttonEvent = () => whatIsFetched == 'meganation' ? whatIsFetched = 'alliance' : whatIsFetched = 'meganation';
var whatIsFetched = 'meganation';
browser.runtime.onMessage.addListener(buttonEvent);

// Listens for requests.
browser.webRequest.onBeforeRequest.addListener(
	function listener(details) { details.url.includes('up/world/earth/') ? onPlayerUpdate(details) : onMapUpdate(details); }, 
	{urls: ['https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json', 
			'https://earthmc.net/map/nova/up/world/earth/*', 
			'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json', 
			'https://earthmc.net/map/aurora/up/world/earth/*']}, 
	['blocking']
);

// Function is fired when the marker_earth request is sent.
function onMapUpdate(details) {
	var usedMap;
	details.url.includes('nova') ? usedMap = 'nova' : usedMap = 'aurora';
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

		fetchAlliances(usedMap == 'nova' ? novaURL : auroraURL).then(meganations => {

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

				meganations.forEach(meganation => {
					if (meganation.type != whatIsFetched) return;
					// Nation controlled by multiple meganations support.
					if (!meganation.nations.includes(nation)) return;
					meganationList.length < 1 ? meganationList += meganation.name : meganationList += ', ' + meganation.name;

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
			filter.write(encoder.encode(JSON.stringify(data)));
			filter.close();
		})
	};
}

// Fired each ~1 second when the update request is sent.
function onPlayerUpdate(details) {
	const filter = browser.webRequest.filterResponseData(details.requestId);
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}));

	filter.onstop = () => {
		arrayBuffer.push(decoder.decode());
		const data = encoder.encode(JSON.stringify(JSON.parse( arrayBuffer.join(''))));

		// If response's length > 64 kB then trigger onMapUpdate(), otherwise write data to the filter
		if (!data.currentcount) return;
		string.length < 65336 ? filter.write(data) : onMapUpdate(details);
		filter.close();
	};
}