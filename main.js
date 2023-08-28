const nationRegex = /(?<=\()[^)]*/,
	nationWikiRegex = /(?<=nofollow">)[^<]+(?=<\/a>\))/,
	nationWikiLinkRegex = /(?<=\(<a href=")[^"]*/,
	townRegex = /(?<=%">)[^ ]*/,
	townWikiRegex = /(?<=nofollow">)[^<]*/,
	townWikiLinkRegex = /(?<=%"><a href=")[^"]*/,
	endpointsURL = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/endpoints.json',
	serverChangedates = {
		membersTitle: 20200410,
		hasUpkeepRemoval: 20220906,
		newMap: 20220428,
		newMarkersPath: 20230201,
		newMarkerJsonPath: 20200322
	};

// Using shoelace formula
function getArea(vertX, vertY, totalVertices) {
	let area = 0;
	let j = totalVertices - 1;
	for (let i = 0; i < totalVertices; i++) {
		area += (vertX[j] + vertX[i]) * (vertY[j] - vertY[i]);
		j = i;
	}
	return Math.abs(area / 2) / (16 * 16);
}

function sendAlert(message, error = null) {
	const button = `<button onclick="document.getElementById('error-label').remove()">OK</button>`;
	document.body.insertAdjacentHTML('beforeend', `<span id="error-label">${message}<br>${button}</span>`);
	if (error) console.log(message + `\n${error}`);
}

// Fowler-Noll-Vo hash function
function hashCode(string) {
	let hexValue = 0x811c9dc5;
	for (let i = 0; i < string.length; i++) {
		hexValue ^= string.charCodeAt(i);
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24);
	}
	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0');
}

async function getAlliances(map) {
	const alliancesArray = [],
		returnOnFail = JSON.parse(localStorage.getItem('emcdynmap-alliances-' + map)) || [];
	const alliancesURL = await fetch(endpointsURL)
		.then(resp => resp.json())
		.then(json => json.alliances.replace('{map}', map))
		.catch(() => {
			sendAlert(`Couldn't get needed data, try again later.`, `Attempted to fetch data from: ${endpointsURL}`);
			return returnOnFail;
		});
	const alliances = await fetch(alliancesURL)
		.then(resp => resp.json())
		.catch(() => {
			sendAlert(`Couldn't get list of alliances, try again later.`, `Attempted to fetch data from: ${alliancesURL}`);
			return returnOnFail;
		});

	alliances.forEach(alliance => {
		let allianceType = alliance.type.toLowerCase() || 'mega';
		if (allianceType === 'sub') return;
		if (allianceType === 'mega') allianceType = 'meganations';
		else allianceType = 'alliances';
		alliancesArray.push({
			name: alliance.fullName || alliance.allianceName,
			type: allianceType,
			nations: alliance.nations,
			colours: alliance.colours || { fill: '#000000', outline: '#000000' }
		});
	});

	localStorage.setItem('emcdynmap-alliances-' + map, JSON.stringify(alliancesArray));
	return alliancesArray;
}

async function getArchive(url) {
	sendAlert('Fetching archive, please wait.');
	const archiveURL = await fetch(endpointsURL)
		.then(resp => resp.json())
		.then(json => json.proxy.replace('{url}', url).replace('{decoded_url}', encodeURIComponent(url)))
		.catch(() => sendAlert(`Couldn't get needed data, try again later.`, `Attempted to fetch data from: ${endpointsURL}`));
	const archive = await fetch(archiveURL)
		.then(resp => resp.json())
		.catch(() => {
			sendAlert(`Couldn't get archive, try again later.`, `Attempted to fetch data from: ${archiveURL}`);
		});
	sendAlert('Fetched archive, reloading page.');
	return JSON.stringify(archive);
}

function setDescription(town, data, jsonPath) {
	const { desc, icon, label, x, z } = town,
		date = sessionStorage.getItem('emcdynmap-date') || '0';
	const townName = (desc.includes('%"><a ')) ? desc.match(townWikiRegex)[0] : desc.match(townRegex)[0],
		nationName = (desc.includes('(<a ')) ? desc.match(nationWikiRegex)[0] : desc.match(nationRegex)[0],
		nationWiki = (desc.includes('(<a ')) ? desc.match(nationWikiLinkRegex)[0] : null,
		townWiki = (desc.includes('%"><a ')) ? desc.match(townWikiLinkRegex)[0] : null,
		membersTitle = (date !== '0' && parseInt(date) < serverChangedates.membersTitle) ? 'Associates' : 'Members',
		memberList = desc.split(`${membersTitle} <span style="font-weight:bold">`)[1].split('</span><br />Flags')[0],
		memberSize = (memberList.match(/,/g) || []).length + 1,
		isCapital = desc.includes('capital: true');
	let area = getArea(x, z, x.length);

	if (icon) {
		const towns = Object.values(data.sets[jsonPath].areas);
		const matchingTowns = towns.filter(town1 => town1.label === label);
		const mappedTowns = matchingTowns.map(town1 => getArea(town1.x, town1.z, town1.x.length));
		area = Math.max(...mappedTowns);
	}

	// Modify description
	if (nationWiki) town.desc = town.desc.replace(/\(.*\)/,
		`(${nationName}) <a target="_blank" title="Open nation's wiki article." href="${nationWiki}" rel="nofollow">📖</a>`);
	if (townWiki) town.desc = town.desc.replace(/(?<!\()<a[^%">][^<]+<\/a>/,
		`${townName} <a target="_blank" title="Open town's wiki article." href="${townWiki}" rel="nofollow">📖</a>`);
	if (isCapital) town.desc = town.desc.replace('120%">', '120%">★ ');
	if (date !== '0' && parseInt(date) < serverChangedates.hasUpkeepRemoval) {
		town.desc = town.desc.replace(/">hasUpkeep:.+?(?<=<br \/>)/, '; white-space:pre">');
	}
	else town.desc = town.desc.replace('">pvp:', '; white-space:pre">pvp:');

	town.desc = town.desc.replace('Flags<br />', '<br>Flags<br>')
		.replace('>pvp:', '>PVP allowed:')
		.replace('>mobs:', '>Mob spawning:')
		.replace('>public:', '>Public status:')
		.replace('>explosion:', '>Explosions:&#9;')
		.replace('>fire:', '>Fire spread:&#9;')
		.replace(/<br \/>capital:.*<\/span>/, '</span>')
		.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
		.replaceAll('false<', '&#9;<span style="color:red">No</span><')
		.replace(`${membersTitle} <span`, `${membersTitle} <b>[${memberSize}]</b> <span`)
		.replace(`</span><br /> ${membersTitle}`, `</span><br>Size<span style="font-weight:bold"> ${area} </span><br> ${membersTitle}`);

	// Scrollable list of members
	if (memberSize > 50) {
		town.desc = town.desc
			.replace(`<b>[${memberSize}]</b> <span style="font-weight:bold">`,
				`<b>[${memberSize}]</b> <div style="overflow:auto;height:200px"><span style="font-weight:bold">`)
			.replace('<br>Flags', '</div><br>Flags');
	}
	return town.desc;
}

// Main code
const _open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = async function (_method, URL) {

	let alliances = [],
		archiveData = null,
		_onreadystatechange = this.onreadystatechange;
	const date = sessionStorage.getItem('emcdynmap-date') || '0',
		mapMode = sessionStorage.getItem('emcdynmap-mapMode') || 'meganations',
		_this = this;

	// Detect XMLHttpRequest client readyState changes
	_this.onreadystatechange = async function () {
		const XMLstate = _this.readyState;
		const map = (location.href.includes('nova')) ? 'nova' : 'aurora';

		// State of XMLHttpRequest client: opened
		if (XMLstate === 1 && URL.includes('marker')) {
			if (date === '0') {
				if (mapMode !== 'default') alliances = await getAlliances(map);
			} else {
				// Current map mode is archive
				const prefixArchiveURL = `https://web.archive.org/web/${date}id_/https://earthmc.net/map`;
				let archiveURL;
				if (parseInt(date) < serverChangedates.newMap) archiveURL = `${prefixArchiveURL}/tiles/_markers_/marker_earth.json`;
				else archiveURL = `${prefixArchiveURL}/${map}/tiles/_markers_/marker_earth.json`;
				if (parseInt(date) > serverChangedates.newMarkersPath) {
					archiveURL = `${prefixArchiveURL}/${map}/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`;
				}
				if (localStorage.getItem(`emcdynmap-latestArchiveDate-${map}`) !== date) {
					try {
						localStorage.setItem(`emcdynmap-latestArchiveDate-${map}`, date);
						localStorage.setItem(`emcdynmap-latestArchive-${map}`, await getArchive(archiveURL));
						location.reload();
					} catch (exception) {
						sendAlert(`Archive is too big and can't be handled (see console for solution).`,
							`For more information, view https://arty.name/localstorage.html for possible solution.`);
					}
				} else archiveData = JSON.parse(localStorage.getItem(`emcdynmap-latestArchive-${map}`));
			}
		}

		// State of XMLHttpRequest client: completed
		if (XMLstate === 4 && URL.match(/marker|update/)) {
			const response = JSON.parse(_this.responseText);
			(URL.includes('marker')) ? mapUpdate() : playerUpdate();

			function playerUpdate() {
				if (date !== '0') _this.abort();
				// If size of response is big enough, it has unwanted map updates
				if (JSON.stringify(response).length < 130672) return;
				response.updates = null;
				Object.defineProperty(_this, 'responseText', { value: JSON.stringify(response) });
				return;
			}

			function mapUpdate() {
				if (date === '0' || !archiveData) execute(response, 'townyPlugin.markerset');
				else {
					const jsonPath = (parseInt(date) < serverChangedates.newMarkerJsonPath) ? 'towny.markerset' : 'townyPlugin.markerset';
					execute(archiveData, jsonPath);
				}

				function execute(data, jsonPath) {
					// Fix a bug with toggling markers
					const stars = data.sets[jsonPath].markers;
					Object.values(stars).forEach(star => star.desc = setDescription(star, data, jsonPath));
					delete data.sets[jsonPath].markers;
					data.sets.markers.markers = stars;

					// Delete shop areas
					Object.keys(data.sets[jsonPath].areas).forEach(area => {
						if (area.includes('_Shop')) delete data.sets[jsonPath].areas[area];
					});

					Object.values(data.sets[jsonPath].areas).forEach(town => {
						town.desc = setDescription(town, data, jsonPath);
						town.weight = 1.5;
						town.opacity = 1;
						town.fillopacity = 0.33;
					});

					if (mapMode === 'archive' || mapMode === 'default') {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					}

					// Specific town modifications
					alliances = JSON.parse(localStorage.getItem(`emcdynmap-alliances-${map}`));
					Object.values(data.sets[jsonPath].areas).forEach(town => {
						const nation = town.desc.match(/\(.*\)/)[0];
						if (town.color === '#3FB4FF' && town.fillcolor === '#3FB4FF') {
							town.color = '#363636';
							town.fillcolor = hashCode(nation);
						} else town.color = '#bFFF00';
						if (nation === '()') town.fillcolor = town.color = '#FF00FF';
						if (town.desc.match(/NPC[0-9]+/) && nation === '()') town.fillcolor = town.color = '#7B00FF';
						if (mapMode === 'alliances') {
							town.color = town.fillcolor = '#000000';
							town.weight = 0.75;
						}
					});

					if (!alliances) {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					};

					// Add alliances to map
					Object.values(data.sets[jsonPath].areas).forEach(town => {
						const nation = (town.desc.includes('(<a ')) ? desc.match(nationWikiRegex)[0] : town.desc.match(nationRegex)[0];
						let meganationList = '';
						let id = '';
						const alliancesOutlines = [];
						alliances.forEach(alliance => {
							if (alliance.nations.includes(nation) && mapMode === alliance.type) {
								town.color = alliance.colours.outline.toUpperCase();
								town.fillcolor = alliance.colours.fill.toUpperCase();
								if (mapMode === 'alliances') town.weight = 1.5;
								meganationList += (meganationList.length < 1) ? alliance.name : ', ' + alliance.name;
								id += alliance.name;
								alliancesOutlines.push(alliance.colours.outline.toUpperCase());
							}
						});

						// Add lands shared with multiple alliances
						id = id.replaceAll(' ', '').replaceAll("'", '');
						if (meganationList.includes(',')) {
							const interval = setInterval(() => {
								if (document.querySelector('svg')) {
									clearInterval(interval);
									if (!document.querySelector(`#${id}`)) {
										const condominium = `<pattern id="${id}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
										<rect class="checker" x="0" width="10" height="10" y="0" fill="${alliancesOutlines[0]}"/>
										<rect class="checker" x="10" width="10" height="10" y="10" fill="${alliancesOutlines[0]}"/>
										<rect class="checker" x="10" width="10" height="10" y="0" fill="${alliancesOutlines[1]}"/>
										<rect class="checker" x="0" width="10" height="10" y="10" fill="${alliancesOutlines[1]}"/>
										</pattern>`;
										document.querySelector('svg').insertAdjacentHTML('afterbegin', condominium);
									}
								}
							}, 1);
							town.fillcolor = `url(#${id})`;
							town.color = "#FF00FF";
							town.weight = 1.5;
						}

						// Add "Part of" label
						if (meganationList.length > 0) {
							const meganationListText = `<br> <span style="font-size:85%">Part of <b>${meganationList}</b></span> <br> Mayor`;
							town.desc = town.desc.replace('<br /> Mayor', meganationListText);
							const marker = data.sets.markers.markers[town.label + '__home'];
							if (marker !== undefined && !marker.desc.includes('85%')) {
								marker.desc = marker.desc.replace('<br /> Mayor', meganationListText);
							}
						}
					});
					Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
				}
			}
		}
		if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
	}

	Object.defineProperty(this, 'onreadystatechange', {
		get: function () { return _onreadystatechange; },
		set: function (value) { _onreadystatechange = value; },
	});
	return _open.apply(_this, arguments);
}