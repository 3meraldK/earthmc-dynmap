const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const novaURL = 'https://emc-toolkit.vercel.app/api/nova/alliances';
const auroraURL = 'https://emc-toolkit.vercel.app/api/aurora/alliances';

// Webpage listener.
let mapMode = 'meganations';
let date = 0;
browser.runtime.onMessage.addListener(webpageListener);
function webpageListener(message) {
	if (message.message) {
		mapMode = mapMode == 'meganations' ? 'alliances' : 'meganations';
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
	function requestListener(details) {
		if (details.url.includes('up/world/earth') || details.url.includes('standalone/dynmap_earth.json')) {
			onPlayerUpdate(details);
		} else onMapUpdate(details);
	},
	{ urls: ['https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json',
		'https://earthmc.net/map/nova/up/world/earth/*',
		'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json',
		'https://earthmc.net/map/aurora/standalone/dynmap_earth.json'] },
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

		arrayBuffer.push(decoder.decode());
		const streamData = JSON.parse(arrayBuffer.join(''));

		// Check the selected mode.
		if (date.length != 8) { execute(streamData, false, 'townyPlugin.markerset'); }
		else {
			const server = (details.url.includes('nova')) ? 'nova' : 'aurora',
				urlProper = [`https://web.archive.org/web/${date}id_/https://earthmc.net/map`, 'tiles/_markers_/marker_earth.json'],
				url = parseInt(date) < 20220428 ? `${urlProper[0]}/${urlProper[1]}` : `${urlProper[0]}/${server}/${urlProper[1]}`,
				jsonPath = parseInt(date) < 20200322 ? 'towny.markerset' : 'townyPlugin.markerset';
			fetch(url)
				.then(res => res.json()).then(archiveData => execute(archiveData, true, jsonPath))
				.catch((error) => {
					console.error(`Could not fetch archives, exiting archive mode: ${error}`);
					execute(streamData, false, 'townyPlugin.markerset');
				});
		}

		// The main function.
		function execute(data, archiveMode, jsonPath) {
			// Move markers to appriopriate path.
			const markers = data.sets[jsonPath].markers;
			Object.values(markers).forEach(marker => delete marker.desc);
			delete data.sets[jsonPath].markers;
			data.sets.markers.markers = markers;

			// Delete shop areas.
			Object.keys(data.sets[jsonPath].areas).forEach(area => {
				if (area.includes('_Shop')) delete data.sets[jsonPath].areas[area];
			});

			// Configure all areas.
			Object.values(data.sets[jsonPath].areas).forEach(townArea => {
				const nation = !townArea.desc.includes('"nofollow">') ? townArea.desc.split(' (')[1].split(')')[0] : townArea.desc.split('"nofollow">')[1].split('</a>)')[0],
					area = calcArea(townArea.x, townArea.z, townArea.x.length),
					membersPlaceholder = (date && parseInt(date) < 20200410) ? 'Associates' : 'Members',
					memberList = townArea.desc.split(`${membersPlaceholder} <span style="font-weight:bold">`)[1].split('</span><br />Flags')[0],
					memberSize = (memberList.match(/,/g) || []).length + 1,
					isCapital = townArea.desc.includes('capital: true'),
					hasWikiLink = townArea.desc.includes('</a>');
				if (hasWikiLink) {
					const link = townArea.desc.split('href="')[1].split('" rel=')[0];
					townArea.desc = townArea.desc.replace(`<a href="${link}" rel="nofollow">${nation}</a>`, `${nation}`)
					townArea.desc = townArea.desc.replace(`${nation})`, `${nation}) <a target="_blank" title="Click to open the wiki article." href="${link}">📖</a>`)
				}
				if (isCapital) townArea.desc = townArea.desc.replace('120%">', '120%">★ ')

				if (date != '0' && parseInt(date) < 20220906) {
					townArea.desc = townArea.desc.replace('">hasUpkeep:', '; white-space:pre">hasUpkeep:');
					townArea.desc = townArea.desc.replace('>hasUpkeep: true<br />', '>').replace('>hasUpkeep: false<br />', '>');
				} else {
					townArea.desc = townArea.desc.replace('">pvp:', '; white-space:pre">pvp:');
				}
				townArea.desc = townArea.desc.replace('>pvp:', '>PVP allowed:')
					.replace('>mobs:', '>Mob spawning:')
					.replace('>public:', '>Public status:')
					.replace('>explosion:', '>Explosions:&#9;')
					.replace('>fire:', '>Fire spread:')
					.replace('<br />capital: false</span>', '</span>')
					.replace('<br />capital: true</span>', '</span>')
					.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
					.replaceAll('false<', '&#9;<span style="color:red">No</span><')
					.replace(`${membersPlaceholder} <span`, `${membersPlaceholder} <b>[${memberSize}]</b> <span`)
					.replace(`</span><br /> ${membersPlaceholder}`, `</span><br />Size<span style="font-weight:bold"> ${area} </span><br /> ${membersPlaceholder}`);

				if (memberSize > 50) {
					townArea.desc = townArea.desc
						.replace(`<b>[${memberSize}]</b> <span style="font-weight:bold">`, `<b>[${memberSize}]</b> <div style="overflow:auto;height:200px;"><span style="font-weight:bold">`)
						.replace('Flags', '</div>Flags')
				}

				townArea.weight = 1.5;
				townArea.opacity = 1;

				if (archiveMode) return;
				if (mapMode == 'alliances') { townArea.color = townArea.fillcolor = '#000000'; }
				else {
					if (townArea.color == '#3FB4FF' && townArea.fillcolor == '#3FB4FF') townArea.color = townArea.fillcolor = '#000000';
					if (nation == '') townArea.fillcolor = townArea.color = '#FF00FF';
				}
			});
			if (archiveMode) {
				filter.write(encoder.encode(JSON.stringify(data)));
				filter.close();
				return;
			}

			// Fetch alliances.
			const alliances = [];
			fetch(details.url.includes('nova') ? novaURL : auroraURL).then(res => res.json())
				.then(alliancesJSON => {
					alliancesJSON.forEach(alliance => {
						let allianceType = alliance.type || 'mega';
						allianceType = allianceType == 'mega' ? 'meganations' : 'alliances'; 
						alliances.push(
							{ name: alliance.fullName || alliance.allianceName,
								type: allianceType,
								nations: alliance.nations,
								colours: alliance.colours || { fill: '#000000', outline: '#000000' },
							});
					});
				}).then(() => {

					// Configure alliances.
					Object.values(data.sets[jsonPath].areas).forEach(townArea => {
						const nation = !townArea.desc.includes('"nofollow">') ? townArea.desc.split(' (')[1].split(')')[0] : townArea.desc.split('"nofollow">')[1].split('</a>)')[0];
						let meganationList = '';
						alliances.forEach(alliance => {
							if (alliance.nations.includes(nation) && mapMode == alliance.type) {
								townArea.color = alliance.colours.outline;
								townArea.fillcolor = alliance.colours.fill;
								meganationList += meganationList.length < 1 ? alliance.name : ', ' + alliance.name;
							}
						});
						if (meganationList.length > 0) townArea.desc = townArea.desc.replace(')</span><br />', `)</span><br /> <span style="font-size:80%">Part of</span> <span style="font-size:90%"><b>${meganationList}</b></span><br />`);
					});
					filter.write(encoder.encode(JSON.stringify(data)));
					filter.close();
				}).catch(error => {
					console.error(`Couldn't fetch alliances: ${error}`);
					filter.write(encoder.encode(JSON.stringify(data)));
					filter.close();
				});
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