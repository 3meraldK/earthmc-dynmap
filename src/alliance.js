async function getAlliances() {
	const response = await fetchJSON(alliancesURL)
	if (!response.ok || !response.data) {
		try {
			const cache = JSON.parse(localStorage['emcdynmapplus-alliances'])
			if (response.code != 429) { // 429 = too many requests, ignore
				sendMessage('The live alliance registry is currently inaccessible - displaying the last version your browser saved.')
			}
			return cache
		} catch (e) {
			sendMessage('The live alliance registry is currently inaccessible, try again later.')
			return []
		}
	}
	const alliances = response.data

	function getAllianceByName(name) {
		return alliances.find(it => it.identifier == name)
	}

	function findRoot(alliance, isFirstSearch = true) {
		if (!alliance.parentAlliance) return (isFirstSearch) ? null : alliance
		return findRoot(getAllianceByName(alliance.parentAlliance), false)
	}

	const nationList = new Map()
	const finalArray = []
	for (const alliance of alliances) {
		const rootName = findRoot(alliance)?.identifier || alliance.identifier
		nationList.set(rootName, [...nationList.get(rootName) || [], alliance.ownNations].flat())
	}
	for (const allianceMap of nationList) {
		const alliance = getAllianceByName(allianceMap[0])
		const allianceType = alliance?.type?.toLowerCase() || 'mega'
		const fill = '#' + alliance?.optional?.colours?.fill || '#000000'
		const outline = '#' + alliance?.optional?.colours?.outline || '#000000'
		finalArray.push({
			name: alliance?.label || allianceMap[0],
			type: allianceType == 'mega' ? 'meganations' : 'alliances',
			nations: allianceMap[1],
			colours: { fill: fill, outline: outline }
		})
	}

	localStorage['emcdynmapplus-alliances'] = JSON.stringify(finalArray)
	return finalArray
}

function getNationAlliances(nation) {
	const nationAlliances = []
	if (alliances == null) return nationAlliances
	for (const alliance of alliances) {
		if (!alliance.nations.includes(nation)) continue
		if (alliance.type != currentMapMode) continue
		if (alliance.colours.fill == '#undefined' || alliance.colours.outline == '#undefined') {
			alliance.colours.fill = alliance.colours.outline = '#3fb4ff'
		}
		nationAlliances.push({name: alliance.name, colours: alliance.colours})
	}
	return nationAlliances
}

// in variables.js
// let alliances = null
// if (currentMapMode != 'default' && currentMapMode != 'archive') getAlliances().then(result => alliances = result)