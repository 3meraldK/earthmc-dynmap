const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const novaURL = 'https://emc-toolkit.vercel.app/api/nova/alliances';
const auroraURL = 'https://emc-toolkit.vercel.app/api/aurora/alliances';
const fetchAlliances = (url) => fetch(url).then(res => res.json()).catch((error) => { console.error(`Could not fetch alliances: ${error}`); });

// Webpage listener.
let mapMode = 'mega';
let date = 0;
browser.runtime.onMessage.addListener(webpageListener);
function webpageListener(message) {
	if (message.message) {
		mapMode == 'mega' ? mapMode = 'normal' : mapMode = 'mega';
		date = 0;
		return;
	}
	date = message.date.toLocaleDateString('sv').replaceAll('-', '');
}

// Courtesy of 32Vache.
function calcArea(x, y, ptsNum) {
	let area = 0;
	let j = ptsNum - 1;
	for (let i = 0; i < ptsNum; i++) {
		area = area + (x[j] + x[i]) * (y[j] - y[i]);
		j = i;
	}
	return (Math.abs(area / 2)) / 256;
}

// Listen for requests.
browser.webRequest.onBeforeRequest.addListener(
	function requestListener(details) { details.url.includes('up/world/earth/') ? onPlayerUpdate(details) : onMapUpdate(details); },
	{ urls: ['https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json',
		'https://earthmc.net/map/nova/up/world/earth/*',
		'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json',
		'https://earthmc.net/map/aurora/up/world/earth/*'] },
	['blocking'],
);

// Manage the map response.
function onMapUpdate(details) {

	const filter = browser.webRequest.filterResponseData(details.requestId);
	const arrayBuffer = [];

	// Get the response.
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, { stream: true }));

	// Modify the response.
	filter.onstop = () => {

		// Check the mode.
		arrayBuffer.push(decoder.decode());
		const streamData = JSON.parse(arrayBuffer.join(''));
		const server = (details.url.includes('nova')) ? 'nova' : 'aurora';
		const urlProper = [`https://web.archive.org/web/${date}id_/https://earthmc.net/map`, 'tiles/_markers_/marker_earth.json'];
		date < '20220428' ? url = `${urlProper[0]}/${urlProper[1]}` : url = `${urlProper[0]}/${server}/${urlProper[1]}`;

		if (date.length != 8) { execute(streamData, true, 'townyPlugin.markerset'); }
		else {
			const jsonPath = date < '20200322' ? 'towny.markerset' : 'townyPlugin.markerset';
			fetch(url)
				.then(res => res.json()).then(fetchData => execute(fetchData, false, jsonPath))
				.catch((error) => {
					console.error(`Could not fetch archives, exiting archive mode: ${error}`);
					execute(streamData, true, 'townyPlugin.markerset');
				});
		}

		// The main function.
		function execute(data, drawAlliances, jsonPath) {

			// Move markers so they can be toggled.
			const markers = data.sets[jsonPath].markers;
			Object.values(markers).forEach(marker => delete marker.desc);
			delete data.sets[jsonPath].markers;
			data.sets.markers.markers = markers;

			// Delete shop areas.
			Object.keys(data.sets[jsonPath].areas).forEach(town => {
				if (data.sets[jsonPath].areas[town].desc.includes('(Shop) (')) delete data.sets[jsonPath].areas[town];
			});

			// Iterate through towns.
			Object.values(data.sets[jsonPath].areas).forEach(town => {

				const townTitle = town.desc.split('<br />')[0].replaceAll(/[()]/g, '').split(' '),
					nation = townTitle[2].replace('</span>', ''),
					area = calcArea(town.x, town.z, town.x.length),
					members = (date && date < '20200410') ? 'Associates' : 'Members';
				memberList = town.desc.split(`${members} <span style="font-weight:bold">`)[1].split('</span><br />Flags')[0],
				memberSize = (memberList.match(/,/g) || []).length + 1;

				// Paint alliances if allowed.
				if (drawAlliances) {
					if (town.color == '#3FB4FF' && town.fillcolor == '#3FB4FF') town.color = town.fillcolor = '#000000';
					if (nation.length < 1) {
						town.fillcolor = town.color = '#FF00FF';
						return;
					}
				}

				// Recreate town description and outline.
				town.desc = town.desc.replace('">hasUpkeep:', '; white-space:pre">hasUpkeep:');
				town.desc = town.desc.replace('>hasUpkeep: true<br />', '>')
					.replace('>pvp:', '>PVP allowed:')
					.replace('>mobs:', '>Mob spawning:')
					.replace('>public:', '>Public status:')
					.replace('>explosion:', '>Explosions:&#9;')
					.replace('>fire:', '>Fire spread:')
					.replace('<br />capital: false</span>', '</span>')
					.replace('<br />capital: true</span>', '</span>')
					.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
					.replaceAll('false<', '&#9;<span style="color:red">No</span><')
					.replace(`${members} <span`, `${members} <b>[${memberSize}]</b> <span`)
					.replace(`</span><br /> ${members}`, `</span><br />Size<span style="font-weight:bold"> ${area} </span><br /> ${members}`);
				town.weight = 1.5;
				town.opacity = 1;
			});

			// Paint alliances.
			if (!drawAlliances) {
				filter.write(encoder.encode(JSON.stringify(data)));
				filter.close();
			}
			else {
				// Fetch alliances.
				fetchAlliances(details.url.includes('nova') ? novaURL : auroraURL).then(alliances => {

					Object.values(data.sets[jsonPath].areas).forEach(town => {

						let townTitle = town.desc.split('<br />')[0],
							meganationList = '';
						townTitle = townTitle.replaceAll(/[()]/g, '').split(' ');
						const nation = townTitle[2].replace('</span>', '');
						if (mapMode == 'normal') town.color = town.fillcolor = '#000000';

						// Paint alliances.
						alliances.forEach(alliance => {
							const allianceType = alliance.type ?? 'mega',
								allianceName = alliance.fullName ?? alliance.allianceName;
							if (allianceType != mapMode || !alliance.nations.includes(nation)) return;
							if (alliance.colours) {
								allianceFillColor = alliance.colours.fill;
								allianceStrokeColor = alliance.colours.outline;
							}
							else { allianceFillColor = allianceStrokeColor = '#000000'; }
							meganationList.length < 1 ? meganationList += allianceName : meganationList += ', ' + allianceName;
							town.color = allianceStrokeColor;
							town.fillcolor = allianceFillColor;
						});

						if (meganationList.length > 0) town.desc = town.desc.replace(')</span><br />', `)</span><br /> <span style="font-size:80%">Part of</span> <span style="font-size:90%"><b>${meganationList}</b></span><br />`);
					});

					// Sending the modified response.
					filter.write(encoder.encode(JSON.stringify(data)));
					filter.close();
				}).catch((error) => {
					console.error(`Could not fetch alliances, sending normal map: ${error}`);
					filter.write(encoder.encode(JSON.stringify(data)));
					filter.close();
				});
			}
		}
	};
}

// Manage the player response.
function onPlayerUpdate(details) {

	const filter = browser.webRequest.filterResponseData(details.requestId);
	const arrayBuffer = [];
	filter.ondata = event => arrayBuffer.push(decoder.decode(event.data, { stream: true }));

	filter.onstop = () => {
		if (date.length == 8) {
			filter.close();
			return;
		}
		arrayBuffer.push(decoder.decode());
		const string = arrayBuffer.join('');
		const data = JSON.parse(string);
		if (!data.currentcount) return;
		// If response is bigger than usual then it is map update.
		string.length < 65536 ? filter.write(encoder.encode(JSON.stringify(data))) : onMapUpdate(details);
		filter.close();
	};
}