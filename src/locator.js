async function getTownSpawn(searchedTownName) {
	if (currentMapMode == 'archive' || !isNostra) {
		if (!isNostra && currentMapMode != 'archive') chosenArchiveDate = 20260412
		const markersURL = getArchiveURL()

		let markers = await fetchJSON(markersURL)

		if (!markers.ok) return null
		if (!markers.data) return false

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			markers = convertOldMarkersStructure(markers.data.sets['towny.markerset'])
		} else if (chosenArchiveDate < 20240623) {
			markers = convertOldMarkersStructure(markers.data.sets['townyPlugin.markerset'])
		} else {
			markers = markers.data[0].markers
		}

		let target = null
		const dummy = document.createElement('div')
		for (const marker of markers) {
			dummy.innerHTML = marker.popup
			const townName = dummy.textContent.replaceAll('\n', '').trim().split(' ')[0].toLowerCase()
			if (townName == searchedTownName) target = marker
		}
		if (!target) return false
		let points = target.points.flat(Infinity)
		let coords = { x: points[0].x, z: points[0].z }
		return coords
	}
	const query = { query: [searchedTownName], template: { coordinates: true } }
	const data = await fetchJSON(apiURL + '/towns', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return null
	try { return { x: Math.round(data.data[0].coordinates.spawn.x), z: Math.round(data.data[0].coordinates.spawn.z) } }
	catch { return false }
}

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const coords = await getTownSpawn(town)
	if (coords == false) return sendMessage('Searched town has not been found.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.search = `zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	if (currentMapMode == 'archive' || !isNostra) {
		if (!isNostra && currentMapMode != 'archive') chosenArchiveDate = 20260412
		const markersURL = getArchiveURL()

		let markers = await fetchJSON(markersURL)
		let capitals
		let popupProperty = chosenArchiveDate < 20240623 ? 'desc' : 'popup'

		if (!markers.ok) return null
		if (!markers.data) return false

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			capitals = Object.values(markers.data.sets['towny.markerset'].markers)
		} else if (chosenArchiveDate < 20240623) {
			capitals = Object.values(markers.data.sets['townyPlugin.markerset'].markers)
		} else {
			capitals = markers.data[0].markers.filter(marker => marker.tooltip_anchor)
		}

		let target = capitals.find(marker => marker[popupProperty].toLowerCase().includes(nation + '</a>)')
			|| marker[popupProperty].toLowerCase().includes(nation + ')'))
		if (!target) return sendMessage('Searched nation has not been found.')
		const coords = (chosenArchiveDate < 20240623) ? {x: target.x, z: target.z } : {x: target.point.x, z: target.point.z }
		location.search = `zoom=4&x=${coords.x}&z=${coords.z}`
	}

	const query = { query: [nation], template: { capital: true } }
	const data = await fetchJSON(apiURL + '/nations', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')
	if (!data.data) return sendMessage('Searched nation has not been found.')

	let capital
	try { capital = data.data[0].capital.name.toLowerCase() }
	catch { return sendMessage('Searched nation has not been found.') }
	const coords = await getTownSpawn(capital)
	if (coords == false) return sendMessage('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.search = `zoom=4&x=${coords.x}&z=${coords.z}`
}

// https://codepen.io/seansean/pen/QxjqVp
function getStringBetween(str, start, end) {
    try { return str.match(new RegExp(start + '(.*)' + end))[1] }
	catch { return null }
}

async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	if (currentMapMode == 'archive' || !isNostra) {
		if (!isNostra && currentMapMode != 'archive') chosenArchiveDate = 20260412
		const markersURL = getArchiveURL()

		let markers = await fetchJSON(markersURL)

		if (!markers.ok) return null
		if (!markers.data) return false

		// Convert old JSON to new
		if (chosenArchiveDate < 20200322) {
			markers = convertOldMarkersStructure(markers.data.sets['towny.markerset'])
		} else if (chosenArchiveDate < 20240623) {
			markers = convertOldMarkersStructure(markers.data.sets['townyPlugin.markerset'])
		} else {
			markers = markers.data[0].markers
		}

		let target = null
		const dummy = document.createElement('div')
		for (const marker of markers) {
			dummy.innerHTML = marker.popup
			const townName = dummy.textContent.replaceAll('\n', '').trim().split(' ')[0]
			if (chosenArchiveDate < 20240623) {
				const membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
				resList = getStringBetween(dummy.textContent, membersTitle + ' ', 'Flags').toLowerCase()
			} else {
				dummy.querySelector('summary').remove()
				resList = dummy.querySelector('details').textContent.replaceAll(/\t|\n/g, '').trim().toLowerCase()
			}
			if (resList.includes(resident)) target = townName
		}

		if (!target) return false
		return locateTown(target)
	}

	const query = { query: [resident], template: { town: true } }
	const data = await fetchJSON(apiURL + '/players', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')

	try {
		const town = data.data[0].town.name.toLowerCase()
		const coords = await getTownSpawn(town)
		if (coords == false) return sendMessage('Unexpected error occurred while searching for resident, please try later.')
		if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
		location.search = `zoom=4&x=${coords.x}&z=${coords.z}`
	} catch {
		return sendMessage(`The searched resident is townless or they opted out of being looked up.`)
	}
}

function locate(selectValue, inputValue) {
	switch (selectValue) {
		case 'Town': locateTown(inputValue); break
		case 'Nation': locateNation(inputValue); break
		case 'Resident': locateResident(inputValue); break
	}
}