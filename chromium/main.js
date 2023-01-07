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

// Return hashed HEX color
function HEXhash(string) {
	let i, l,
		hval = 0x811c9dc5;

	for (i = 0, l = string.length; i < l; i++) {
		hval ^= string.charCodeAt(i);
		hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
	}

	return `#${((hval >>> 0) % 16777216).toString(16)}`;
}

async function getAlliances(server) {
	const alliances = [];
	await fetch(`https://emc-toolkit.vercel.app/api/${server}/alliances`).then(res => res.json()).then(alliancesJSON => {
		alliancesJSON.forEach(alliance => {
			let allianceType = alliance.type || 'mega';
			allianceType = allianceType == 'mega' ? 'meganations' : 'alliances';
			alliances.push({
				name: alliance.fullName || alliance.allianceName,
				type: allianceType,
				nations: alliance.nations,
				colours: alliance.colours || { fill: '#000000', outline: '#000000' }
			});
		});
		window.localStorage.setItem(`alliances${server}`, JSON.stringify(alliances));
		return alliances;
	}).catch(error => {
		console.log(`Couldn't fetch alliances: ${error}`);
		document.body.insertAdjacentHTML('beforeend', `<span id="error-label" style="position: fixed;height: 50px;width: 250px;top: 50%;left: 50%;margin: -25px 0 0 -125px;text-align: center;background-color: #ffffff;z-index: 10000;color: black;font-size:22px;">Could not fetch latest alliances, try again soon.<button onclick="document.getElementById('error-label').remove()">OK</button></span>`);
		return JSON.parse(window.localStorage.getItem(`alliances${server}`)) || [];
	});
	return alliances;
}
async function getArchive(url) {
	document.body.insertAdjacentHTML('beforeend', `<span id="wait-label" style="position: fixed;height: 50px;width: 250px;top: 50%;left: 50%;margin: -25px 0 0 -125px;text-align: center;background-color: #ffffff;z-index: 10000;color: black;font-size:22px;">Fetching archive, please wait.</span>`);
	const targetURL = `https://api.codetabs.com/v1/proxy/?quest=${url}`,
		response = await fetch(targetURL).then(res => res.json()).catch(error => console.log(`Could not fetch archives: ${error}`));
	document.getElementById('wait-label').textContent = 'Fetched archive, reloading the page.';
	return JSON.stringify(response);
}

const _open = XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = async function (_method, URL) {
	let alliances = [];
	let archiveData = null;
	const date = window.sessionStorage.getItem('date') || '0';
	const _this = this;
	let _onreadystatechange = this.onreadystatechange;
	_this.onreadystatechange = async function () {
		let state = _this.readyState;
		const server = window.location.href.includes('nova') ? 'nova' : 'aurora';
		if (state == 1 && URL.includes('tiles/_markers_/marker_earth.json')) {
			if (date == '0') { alliances = await getAlliances(server); }
			else {
				const urlProper = [`https://web.archive.org/web/${date}id_/https://earthmc.net/map`, 'tiles/_markers_/marker_earth.json'];
				const archiveURL = parseInt(date) < 20220428 ? `${urlProper[0]}/${urlProper[1]}` : `${urlProper[0]}/${server}/${urlProper[1]}`;
				if (window.localStorage.getItem('latestArchiveDate') != date) {

					window.localStorage.setItem('latestArchive', await getArchive(archiveURL));
					window.localStorage.setItem('latestArchiveDate', date);
					window.location.reload();
				} else {
					archiveData = JSON.parse(window.localStorage.getItem('latestArchive'));
				}
			}
		}
		if (state === 4 && (URL.includes('tiles/_markers_/marker_earth.json') || URL.includes('standalone/dynmap_earth.json') || URL.includes('up/world/earth'))) {
			const streamData = JSON.parse(_this.responseText);
			URL.includes('tiles/_markers_/marker_earth.json') ? mapUpdate() : playerUpdate();

			function playerUpdate() {
				if (date != '0') _this.abort();
				if (JSON.stringify(streamData).length > 65536) {
					streamData.updates = null;
					Object.defineProperty(_this, 'responseText', { value: JSON.stringify(streamData) });
					return;
				}
			}

			function mapUpdate() {
				// Check the selected mode.
				if (date == '0') {
					execute(streamData, 'townyPlugin.markerset');
					return;
				}
				if (!archiveData) {
					execute(streamData, 'townyPlugin.markerset');
					return;
				}
				jsonPath = parseInt(date) < 20200322 ? 'towny.markerset' : 'townyPlugin.markerset';
				execute(archiveData, jsonPath);

				function execute(data, jsonPath) {
					// Move markers to appriopriate path.
					const markers = data.sets[jsonPath].markers;
					const mapMode = window.sessionStorage.getItem('mapMode') || 'meganations';
					Object.values(markers).forEach(marker => delete marker.desc);
					delete data.sets[jsonPath].markers;
					data.sets.markers.markers = markers;

					// Delete shop areas.
					Object.keys(data.sets[jsonPath].areas).forEach(area => {
						if (area.includes('_Shop')) delete data.sets[jsonPath].areas[area];
					});
					// Configure all areas.
					Object.values(data.sets[jsonPath].areas).forEach(townArea => {
						const nation = !townArea.desc.includes('"nofollow">') ? townArea.desc.split(' (')[1].split(')')[0] : townArea.desc.split('"nofollow">')[1].split('</a>)')[0];
						area = calcArea(townArea.x, townArea.z, townArea.x.length);
						membersPlaceholder = (date != '0' && parseInt(date) < 20200410) ? 'Associates' : 'Members';
						memberList = townArea.desc.split(`${membersPlaceholder} <span style="font-weight:bold">`)[1].split('</span><br />Flags')[0];
						memberSize = (memberList.match(/,/g) || []).length + 1;
						isCapital = townArea.desc.includes('capital: true');
						hasWikiLink = townArea.desc.includes('</a>');
						if (hasWikiLink) {
							const link = townArea.desc.split('href="')[1].split('" rel=')[0];
							townArea.desc = townArea.desc.replace(`<a href="${link}" rel="nofollow">${nation}</a>`, `${nation}`);
							townArea.desc = townArea.desc.replace(`${nation})`, `${nation}) <a target="_blank" title="Click to open the wiki article." href="${link}">📖</a>`);
						}
						if (isCapital) townArea.desc = townArea.desc.replace('120%">', '120%">★ ');

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
							.replace('>fire:', '>Fire spread:&#9;')
							.replace('<br />capital: false</span>', '</span>')
							.replace('<br />capital: true</span>', '</span>')
							.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
							.replaceAll('false<', '&#9;<span style="color:red">No</span><')
							.replace(`${membersPlaceholder} <span`, `${membersPlaceholder} <b>[${memberSize}]</b> <span`)
							.replace(`</span><br /> ${membersPlaceholder}`, `</span><br />Size<span style="font-weight:bold"> ${area} </span><br /> ${membersPlaceholder}`);

						if (memberSize > 50) {
							townArea.desc = townArea.desc
								.replace(`<b>[${memberSize}]</b> <span style="font-weight:bold">`, `<b>[${memberSize}]</b> <div style="overflow:auto;height:200px;"><span style="font-weight:bold">`)
								.replace('Flags', '</div>Flags');
						}

						townArea.weight = 1.5;
						townArea.opacity = 1;
						townArea.fillopacity = 0.33;

					});
					if (mapMode == 'archive') {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					}
					alliances = JSON.parse(window.localStorage.getItem(`alliances${server}`));
					Object.values(data.sets[jsonPath].areas).forEach(townArea => {
						const nation = !townArea.desc.includes('"nofollow">') ? townArea.desc.split(' (')[1].split(')')[0] : townArea.desc.split('"nofollow">')[1].split('</a>)')[0];
						if (mapMode == 'alliances') {
							townArea.color = townArea.fillcolor = '#000000';
							townArea.weight = 0.75;
						}
						else {
							if (townArea.color == '#3FB4FF' && townArea.fillcolor == '#3FB4FF') {
								townArea.color = '#363636';
								townArea.fillcolor = HEXhash(nation);
							} else townArea.color = '#bfff00';
							if (townArea.desc.includes('NPC')) townArea.fillcolor = townArea.color = '#7B00FF';
							if (nation == '') townArea.fillcolor = townArea.color = '#FF00FF';
						}
						let meganationList = '';
						let id = '';
						const alliancesOutlines = [];
						alliances.forEach(alliance => {
							if (alliance.nations.includes(nation) && mapMode == alliance.type) {
								townArea.color = alliance.colours.outline;
								townArea.fillcolor = alliance.colours.fill;
								if (mapMode == 'alliances') townArea.weight = 1.5;
								meganationList += meganationList.length < 1 ? alliance.name : ', ' + alliance.name;
								id += alliance.name;
								alliancesOutlines.push(alliance.colours.outline);
							}
						});

						// Condominiums
						const a = alliancesOutlines[0]
						const b = alliancesOutlines[1]
						id = id.replaceAll(' ', '');
						if (meganationList.includes(',')) {
							const interval = setInterval(() => {
								if (document.getElementsByTagName('svg')[0]) {
									clearInterval(interval);
									if (!document.getElementById(id)) {
										const condominium = `<pattern id="${id}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
										<rect class="checker" x="0" width="10" height="10" y="0" fill="${a}"/>
										<rect class="checker" x="10" width="10" height="10" y="10" fill="${a}"/>
										<rect class="checker" x="10" width="10" height="10" y="0" fill="${b}"/>
										<rect class="checker" x="0" width="10" height="10" y="10" fill="${b}"/>
										</pattern>`
										document.getElementsByTagName('svg')[0].insertAdjacentHTML('afterbegin', condominium);
									}

								}
							}, 1);
							townArea.fillcolor = `url(#${id})`
							townArea.color = "#FF00FF"
							townArea.weight = 1.5;
						}

						if (meganationList.length > 0) {
							if (townArea.desc.includes('</a>')) townArea.desc = townArea.desc.replace('</a></span><br />', `</a></span><br /> <span style="font-size:80%">Part of</span> <span style="font-size:90%"><b>${meganationList}</b></span><br />`);
							else townArea.desc = townArea.desc.replace(')</span><br />', `)</span><br /> <span style="font-size:80%">Part of</span> <span style="font-size:90%"><b>${meganationList}</b></span><br />`);
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