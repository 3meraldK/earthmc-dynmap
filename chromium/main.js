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

async function getAlliances(server) {
	const alliances = [];
	await fetch(`https://emc-toolkit.vercel.app/api/${server}/alliances`).then(res => res.json()).then(alliancesJSON => {
		alliancesJSON.forEach(alliance => {
			alliances.push({ name: alliance.fullName || alliance.allianceName,
				type: alliance.type || 'mega',
				nations: alliance.nations,
				colours: alliance.colours || { fill: '#000000', outline: '#000000' },
			});
		});
	}).catch(() => alert('Could not fetch alliances, try again later.'));
	return alliances;
}
async function getArchive(url) {
	const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`).then(res => res.json()).catch(() => alert('Could not fetch archives, try again later.'));
	return JSON.parse(response.contents);
}

const _open = XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = async function(method, URL) {
	let _onreadystatechange = this.onreadystatechange;
	let alliances = [];
	let archiveData = null;
	let done = false;
	const date = window.sessionStorage.getItem('date') || '0';
	const _this = this;

	_this.onreadystatechange = async function() {
		const server = window.location.href.includes('nova') ? 'nova' : 'aurora';
		if (_this.readyState == 1 && URL.includes('tiles/_markers_/marker_earth.json') && method == 'GET') {
			if (date == '0') {alliances = await getAlliances(server);}
			else {
				const urlProper = [`https://web.archive.org/web/${date}id_/https://earthmc.net/map`, 'tiles/_markers_/marker_earth.json'];
				const archiveURL = parseInt(date) < 20220428 ? `${urlProper[0]}/${urlProper[1]}` : `${urlProper[0]}/${server}/${urlProper[1]}`;
				archiveData = await getArchive(archiveURL);
			}
		}
		if (method == 'GET' && _this.readyState === 4 && _this.status === 200 && (URL.includes('tiles/_markers_/marker_earth.json') || URL.includes('aurora/standalone/dynmap_earth.json') || URL.includes('up/world/earth'))) {

			const streamData = JSON.parse(_this.responseText);
			if (URL.includes('tiles/_markers_/marker_earth.json')) {
				if (!done) {
					mapUpdate();
					done = true;
				}
			} else playerUpdate();

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
				if (date == '0') { execute(streamData, 'townyPlugin.markerset'); }
				else if (!archiveData) { execute(streamData, 'townyPlugin.markerset'); }
				else {
					jsonPath = parseInt(date) < 20200322 ? 'towny.markerset' : 'townyPlugin.markerset';
					execute(archiveData, jsonPath);
				}

				function execute(data, jsonPath) {
					// Move markers to appriopriate path.
					const markers = data.sets[jsonPath].markers;
					const mapMode = window.sessionStorage.getItem('mapMode') || 'mega';
					Object.values(markers).forEach(marker => delete marker.desc);
					delete data.sets[jsonPath].markers;
					data.sets.markers.markers = markers;

					// Delete shop areas.
					Object.keys(data.sets[jsonPath].areas).forEach(area => {
						if (area.includes('_Shop')) delete data.sets[jsonPath].areas[area];
					});
					// Configure all areas.
					Object.values(data.sets[jsonPath].areas).forEach(townArea => {
						const area = calcArea(townArea.x, townArea.z, townArea.x.length);
						const membersPlaceholder = (date != '0' && parseInt(date) < 20200410) ? 'Associates' : 'Members';
						const memberList = townArea.desc.split(`${membersPlaceholder} <span style="font-weight:bold">`)[1].split('</span><br />Flags')[0];
						const memberSize = (memberList.match(/,/g) || []).length + 1;

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

						townArea.weight = 1.5;
						townArea.opacity = 1;
					});
					if (mapMode == 'archive') {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					}
					Object.values(data.sets[jsonPath].areas).forEach(townArea => {
						if (mapMode == 'normal') { townArea.color = townArea.fillcolor = '#000000'; }
						else {
							const nation = !townArea.desc.includes('"nofollow">') ? townArea.desc.split(' (')[1].split(')')[0] : townArea.desc.split('"nofollow">')[1].split('</a>)')[0];
							if (townArea.color == '#3FB4FF' && townArea.fillcolor == '#3FB4FF') townArea.color = townArea.fillcolor = '#000000';
							if (nation == '') townArea.fillcolor = townArea.color = '#FF00FF';
						}
					});
					// Configure alliances.
					if (alliances.length == 0) {
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
						return;
					}
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
					if (mapMode != 'archive') { 
						Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
					};
				}
			}
		}
		if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
	};
	Object.defineProperty(this, 'onreadystatechange', {
		get: function() { return _onreadystatechange; },
		set: function(value) { _onreadystatechange = value; },
	});

	return _open.apply(_this, arguments);
};