const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const novaURL = 'https://earthmc-api.herokuapp.com/api/v1/nova/alliances';
const auroraURL = 'https://earthmc-api.herokuapp.com/api/v1/aurora/alliances';
const fetchAlliances = (url) => fetch(url).then(res => res.json()).catch(() => {});
const buttonEvent = () => mapMode == 'mega' ? mapMode = 'normal' : mapMode = 'mega';
var mapMode = 'mega';
browser.runtime.onMessage.addListener(buttonEvent);

// Courtesy of 32Vache :)
function calcArea(x, y, ptsNum) {
	var area = 0;
	var j = ptsNum - 1;
	for (var i = 0; i < ptsNum; i++) {
		area = area + (x[j] + x[i]) * (y[j] - y[i]);
		j = i;
	}
	return (Math.abs(area / 2)) / 256;
}

// Listening for browser requests.
browser.webRequest.onBeforeRequest.addListener(
	function listener(details) { details.url.includes('up/world/earth/') ? onPlayerUpdate(details) : onMapUpdate(details); }, 
	{urls: ['https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json', 
			'https://earthmc.net/map/nova/up/world/earth/*', 
			'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json', 
			'https://earthmc.net/map/aurora/up/world/earth/*']}, 
	['blocking']
);

// Managing the map update response.
function onMapUpdate(details) {

	// Getting the response.
	const filter = browser.webRequest.filterResponseData(details.requestId);
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}));

	// Modifying the response.
	filter.onstop = () => {

		arrayBuffer.push(decoder.decode());
		const data = JSON.parse(arrayBuffer.join(''));
		if (data.sets == undefined) return;
		
		// Delete star icons.
		delete data.sets["townyPlugin.markerset"].markers;

		// Iterating through every area drawn on the map.
		Object.values(data.sets["townyPlugin.markerset"].areas).forEach(town => {

			// Some variables.
			var townTitle = town.desc.split('<br \/>')[0];
			townTitle = townTitle.replace(/\(Shop\)$/g, '').replaceAll(/[()]/g, '').split(' ');
			const nation = townTitle[2].replace('</span>', '');
			const area = calcArea(town.x, town.z, town.x.length);
			const memberList = town.desc.split('Members <span style=\"font-weight:bold\">')[1].split('</span><br />Flags')[0];
			const memberSize = (memberList.match(/,/g) || []).length + 1;

			// Removing shop areas.
			if (town.desc.includes('(Shop) (')) {
				town.fillopacity = 0;
				town.opacity = 0;
			}

			// Recreating town's description.
			town.desc = town.desc.replace('>hasUpkeep:', '>Has upkeep:').replace('>pvp:', '>PVP allowed:').replace('>mobs:', '>Mob spawning:').replace('>public:', '>Public status:').replace('>explosion:', '>Explosions:').replace('>fire:', '>Fire spread:').replace('>capital:', '>Is capital:');
			town.desc = town.desc.replaceAll('true<', '\u2705<').replaceAll('false<', '\u26D4<');
			town.desc = town.desc.replace('Members <span', 'Members <b>[' + memberSize + ']</b> <span');
			town.desc = town.desc.replace('</span><br /> Members', '</span><br />Size<span style=\"font-weight:bold\"> ' + area + ' </span><br /> Members');

			// Modifying esthetics of the area.
			town.weight = 1;
			town.opacity = 0.7;
			if (town.color == "#3FB4FF" && town.fillcolor == "#3FB4FF") town.color = "#000000", town.fillcolor = "#000000";
			if (nation.length < 1) {
				town.color = '#83003F';
				town.fillcolor = '#83003F';
				return;
			}
		})

		// Fetching alliances from appriopriate worlds.
		details.url.includes('nova') ? usedMap = 'nova' : usedMap = 'aurora';
		fetchAlliances(usedMap == 'nova' ? novaURL : auroraURL).then(alliances => {

			Object.values(data.sets["townyPlugin.markerset"].areas).forEach(town => {

				var townTitle = town.desc.split('<br \/>')[0];
				townTitle = townTitle.replace(/\(Shop\)$/g, '').replaceAll(/[()]/g, '').split(' ');
				const nation = townTitle[2].replace('</span>', '');
				var meganationList = '';

				alliances.forEach(alliance => {

					// Some variables and their default values.
					var allianceType, allianceName, allianceStrokeColor, allianceFillColor;
					allianceType = alliance.type ?? 'mega';
					allianceName = alliance.fullName ?? alliance.allianceName;
					if (alliance.hasOwnProperty('colours')) {
						allianceFillColor = alliance.colours.fill;
						allianceStrokeColor = alliance.colours.outline;
					} else {
						allianceFillColor = "#000000";
						allianceStrokeColor = "#000000";
					}
					
					if (allianceType != mapMode) return;
					if (!alliance.nations.includes(nation)) return;
					meganationList.length < 1 ? meganationList += allianceName : meganationList += ', ' + allianceName;

					// Esthetics of alliance areas; their visuals differ from single nations and nationless towns.
					if (!town.desc.includes('(Shop) (')) {
						town.weight = 2.2;
						town.opacity = 1;
						town.color = allianceStrokeColor;
						town.fillcolor = allianceFillColor;
					}
				});

				// Assigning the alliance name to the town.
				if (meganationList.length > 0) town.desc = town.desc.replace(')</span><br />', ')</span><br /> ' + 
					'<span style=\"font-size:80%\">Part of</span> ' + 
					'<span style=\"font-size:90%\"><b>' + meganationList + '</b></span><br />');
				
			});

			// Sending the modified response.
			filter.write(encoder.encode(JSON.stringify(data)));
			filter.close();
		}).catch((error) => {
			console.log('Could not connect to the database! Error: ' + error);
			filter.write(encoder.encode(JSON.stringify(data)));
			filter.close();
		});
	}
}

// Managing the players' status response.
function onPlayerUpdate(details) {

	const filter = browser.webRequest.filterResponseData(details.requestId);
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, {stream: true}));

	filter.onstop = () => {
		arrayBuffer.push(decoder.decode());
		const string = arrayBuffer.join('');
		const data = JSON.parse(string);
		if (!data.currentcount) return;
		// If response's size > 64kB, it's a map update.
		string.length < 65536 ? filter.write(encoder.encode(JSON.stringify(data))) : onMapUpdate(details);
		filter.close();
	}
}