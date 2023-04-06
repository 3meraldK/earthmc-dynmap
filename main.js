// Constants used in the entire script.
const alertMsgStyle =
	`position: absolute;
	height: 80px;
	width: 250px;
	top: 50%;
	left: 50%;
	text-align: center;
	background-color: #ffffff;
	color: black;
	font-size: 22px;
	margin-top: -40px;
	margin-left: -125px`,
	nationRegex = /(?<=\()[^)]*/,
	nationWikiRegex = /(?<=nofollow">)[^<]+(?=<\/a>\))/,
	endpointsURL = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/endpoints.json';

// The shoelace formula, returns area of polygon.
function getArea(vertX, vertY, totalVertices) {

	let area = 0;
	let j = totalVertices - 1;
	for (let i = 0; i < totalVertices; i++) {
		area += (vertX[j] + vertX[i]) * (vertY[j] - vertY[i]);
		j = i;
	}
	return Math.abs(area / 2) / 256;

}

// Send alerts.
function sendAlert(message, error = null) {
	const button = `<button onclick="document.querySelector('#error-label').remove()">OK</button>`;
	document.body.insertAdjacentHTML('beforeend', `<span id="error-label" style="${alertMsgStyle}">${message}<br>${button}</span>`);
	if (error) console.log(message + `\n${error}`);
}

// Fowler-Noll-Vo hash function, returns hash code value in hexadecimal form.
function hashCode(string) {

	let hexValue = 0x811c9dc5;
	for (let i = 0; i < string.length; i++) {
		hexValue ^= string.charCodeAt(i);
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24);
	}
	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0');

}

// Fetch alliances.
async function getAlliances(map) {

	const alliancesArray = [];
	const endpoints = await fetch(endpointsURL)
		.then(response => response.json())
		.catch((error) => sendAlert('Could not fetch dataset of URLs, try again soon.', error));

	await fetch(endpoints.alliances.replace('{map}', map))
		.then(response1 => response1.json())
		.then(alliances => {

			alliances.forEach(alliance => {
				let allianceType = alliance.type.toLowerCase() || 'mega';
				allianceType = allianceType === 'mega' ? 'meganations' : 'alliances';
				alliancesArray.push({
					name: alliance.fullName || alliance.allianceName,
					type: allianceType,
					nations: alliance.nations,
					colours: alliance.colours || { fill: '#000000', outline: '#000000' }
				});
			});
			localStorage.setItem('alliances-' + map, JSON.stringify(alliancesArray));
			return alliancesArray;

		}).catch(error => {
			sendAlert('Third-party data source temporarily unavailable, try again soon.', error);
			return JSON.parse(localStorage.getItem('alliances-' + map)) || [];
		});
	return alliancesArray;

}

// Fetch archived towns.
async function getArchive(url) {

	sendAlert('Fetching archive, please wait.');
	const endpoints = await fetch(endpointsURL)
		.then(response => response.json())
		.catch((error) => sendAlert('Could not fetch dataset of URLs, try again soon.', error));
	const archiveMarkers = await fetch(endpoints.proxy.replace('{url}', url).replace('{decoded_url}', encodeURIComponent(url)))
		.then(response1 => response1.json())
		.catch(error => sendAlert('Could not fetch archives, try again soon.', error));
	sendAlert('Fetched archive, reloading the page.');
	return JSON.stringify(archiveMarkers);

}

// Set description of town.
function setDescription(town, data, jsonObject) {

	// Get various variables with help of RegExp.
	const { desc, icon, label, x, z } = town,
		date = sessionStorage.getItem('date') || '0',
		townRegex = /(?<=%">)[^ ]*/,
		townWikiRegex = /(?<=nofollow">)[^<]*/,
		townWikiLinkRegex = /(?<=%"><a href=")[^"]*/,
		nationWikiLinkRegex = /(?<=\(<a href=")[^"]*/;
	const townName = desc.includes('%"><a ') ? desc.match(townWikiRegex)[0] : desc.match(townRegex)[0],
		nationName = desc.includes('(<a ') ? desc.match(nationWikiRegex)[0] : desc.match(nationRegex)[0],
		nationWiki = desc.includes('(<a ') ? desc.match(nationWikiLinkRegex)[0] : null,
		townWiki = desc.includes('%"><a ') ? desc.match(townWikiLinkRegex)[0] : null,
		membersPlaceholder = (date !== '0' && parseInt(date) < 20200410) ? 'Associates' : 'Members',
		memberList = desc.split(`${membersPlaceholder} <span style="font-weight:bold">`)[1].split('</span><br />Flags')[0],
		memberSize = (memberList.match(/,/g) || []).length + 1,
		isCapital = desc.includes('capital: true');
	let area = getArea(x, z, x.length);

	if (icon !== undefined) {
		const towns = Object.values(data.sets[jsonObject].areas);
		const matchingTowns = towns.filter(town1 => town1.label === label);
		const mappedTowns = matchingTowns.map(town1 => getArea(town1.x, town1.z, town1.x.length));
		area = Math.max(...mappedTowns);
	}

	// Modify description.
	if (nationWiki !== null) town.desc = town.desc.replace(/\(.*\)/,
		`(${nationName}) <a target="_blank" title="Open nation's wiki article." href="${nationWiki}" rel="nofollow">📖</a>`);
	if (townWiki !== null) town.desc = town.desc.replace(/(?<!\()<a[^%">][^<]+<\/a>/,
		`${townName} <a target="_blank" title="Open town's wiki article." href="${townWiki}" rel="nofollow">📖</a>`);
	if (isCapital) town.desc = town.desc.replace('120%">', '120%">★ ');
	if (date !== '0' && parseInt(date) < 20220906) town.desc = town.desc.replace(/">hasUpkeep:.*<br \/>/, '; white-space:pre">');
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
		.replace(`${membersPlaceholder} <span`, `${membersPlaceholder} <b>[${memberSize}]</b> <span`)
		.replace(`</span><br /> ${membersPlaceholder}`, `</span><br>Size<span style="font-weight:bold"> ${area} </span><br> ${membersPlaceholder}`);

	if (memberSize > 50) {
		town.desc = town.desc
			.replace(`<b>[${memberSize}]</b> <span style="font-weight:bold">`,
				`<b>[${memberSize}]</b> <div style="overflow:auto;height:200px;"><span style="font-weight:bold">`)
			.replace('<br>Flags', '</div><br>Flags');
	}
	return town.desc;

}

// Main function.
const _open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = async function (_method, URL) {

	let alliances = [],
		archiveData = null,
		_onreadystatechange = this.onreadystatechange;
	const date = sessionStorage.getItem('date') || '0';
	const _this = this;

	_this.onreadystatechange = async function () {
		const XMLstate = _this.readyState;
		const map = location.href.includes('nova') ? 'nova' : 'aurora';

		// State of XMLHttpRequest client is: opened.
		if (XMLstate === 1 && URL.includes('marker')) {
			if (date === '0') alliances = await getAlliances(map);
			else {

				// If user selected archive mode.
				const baseArchiveURL = `https://web.archive.org/web/${date}id_/https://earthmc.net/map`;
				const oldMarkersURL = 'tiles/_markers_/marker_earth.json';
				let archiveURL = parseInt(date) < 20220428 ? `${baseArchiveURL}/${oldMarkersURL}` : `${baseArchiveURL}/${map}/${oldMarkersURL}`;
				if (parseInt(date) > 20230201) archiveURL = `${baseArchiveURL}/${map}/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`;
				if (localStorage.getItem('latestArchiveDate') !== date) {

					localStorage.setItem('latestArchive', await getArchive(archiveURL));
					localStorage.setItem('latestArchiveDate', date);
					location.reload();

				} else archiveData = JSON.parse(localStorage.getItem('latestArchive'));

			}
		}

		// State of XMLHttpRequest client is: completed.
		if (XMLstate === 4 && URL.match(/marker|update/)) {

			const response = JSON.parse(_this.responseText);
			URL.includes('marker') ? mapUpdate() : playerUpdate();

			// Handle player updates.
			function playerUpdate() {
				if (date !== '0') _this.abort();
				if (JSON.stringify(response).length < 130672) return;
				response.updates = null;
				Object.defineProperty(_this, 'responseText', { value: JSON.stringify(response) });
				return;
			}

			// Handle marker_<world>.json updates.
			function mapUpdate() {

				// Check the selected mode.
				if (date === '0' || !archiveData) execute(response, 'townyPlugin.markerset');
				else {
					const jsonObject = parseInt(date) < 20200322 ? 'towny.markerset' : 'townyPlugin.markerset';
					execute(archiveData, jsonObject);
				}

				function execute(data, jsonObject) {

					// Move stars to appriopriate path.
					const stars = data.sets[jsonObject].markers;
					const mapMode = sessionStorage.getItem('mapMode') || 'meganations';
					Object.values(stars).forEach(star => star.desc = setDescription(star, data, jsonObject));
					delete data.sets[jsonObject].markers;
					data.sets.markers.markers = stars;

					// Delete shop areas.
					Object.keys(data.sets[jsonObject].areas).forEach(area => {
						if (area.includes('_Shop')) delete data.sets[jsonObject].areas[area];
					});

					// Configure all towns and modify their description.
					Object.values(data.sets[jsonObject].areas).forEach(town => {
						town.desc = setDescription(town, data, jsonObject);
						town.weight = 1.5;
						town.opacity = 1;
						town.fillopacity = 0.33;
					});

					// Stop script if map mode is archive or default.
					if (mapMode === 'archive' || mapMode === 'default') {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					}

					// Configure all towns in alliances/meganations map mode.
					alliances = JSON.parse(localStorage.getItem(`alliances-${map}`));
					Object.values(data.sets[jsonObject].areas).forEach(town => {

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

					if (alliances === null) {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					};

					// Configure all alliances.
					Object.values(data.sets[jsonObject].areas).forEach(town => {

						const nation = town.desc.includes('(<a ') ? desc.match(nationWikiRegex)[0] : town.desc.match(nationRegex)[0];
						let meganationList = '';
						let id = '';
						const alliancesOutlines = [];
						alliances.forEach(alliance => {
							if (alliance.nations.includes(nation) && mapMode === alliance.type) {
								town.color = alliance.colours.outline.toUpperCase();
								town.fillcolor = alliance.colours.fill.toUpperCase();
								if (mapMode === 'alliances') town.weight = 1.5;
								meganationList += meganationList.length < 1 ? alliance.name : ', ' + alliance.name;
								id += alliance.name;
								alliancesOutlines.push(alliance.colours.outline.toUpperCase());
							}
						});

						// Condominiums.
						const a = alliancesOutlines[0],
							b = alliancesOutlines[1];
						id = id.replaceAll(' ', '');
						if (meganationList.includes(',')) {
							const interval = setInterval(() => {
								if (document.querySelector('svg')) {
									clearInterval(interval);
									if (!document.querySelector(`#${id}`)) {
										const condominium = `<pattern id="${id}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
										<rect class="checker" x="0" width="10" height="10" y="0" fill="${a}"/>
										<rect class="checker" x="10" width="10" height="10" y="10" fill="${a}"/>
										<rect class="checker" x="10" width="10" height="10" y="0" fill="${b}"/>
										<rect class="checker" x="0" width="10" height="10" y="10" fill="${b}"/>
										</pattern>`;
										document.querySelector('svg').insertAdjacentHTML('afterbegin', condominium);
									}

								}
							}, 1);
							town.fillcolor = `url(#${id})`;
							town.color = "#FF00FF";
							town.weight = 1.5;
						}

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