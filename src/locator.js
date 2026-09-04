async function getTownSpawn(searchedTownName) {
	// archive locator, data scraping
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

	// the moon locator, data scraping
	if (isMoon()) {
		try {
			let markers = await fetchJSON('https://map.earthmc.net/tiles/earthmc_moon/markers.json')
			markers = markers.data.find(layer => layer.id == 'towny').markers
			let target = null
			const dummy = document.createElement('div')
			for (const marker of markers) {
				dummy.innerHTML = marker.tooltip
				const townName = dummy.textContent.split(' ')[4].toLowerCase()
				if (townName == searchedTownName) target = marker
			}
			if (!target) return false
			let points = target.points.flat(Infinity)
			let coords = { x: points[0].x, z: points[0].z }
			return coords
		} catch (_) {
			return null
		}
	}

	// api call
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
	const world = isMoon() ? 'earthmc_moon' : 'minecraft_overworld'
	location.search = `zoom=4&x=${coords.x}&z=${coords.z}&world=${world}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	// archive locator, data scraping
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

	// the moon locator, data scraping
	if (isMoon()) {
		try {
			let markers = await fetchJSON('https://map.earthmc.net/tiles/earthmc_moon/markers.json')
			markers = markers.data.find(layer => layer.id == 'towny').markers
			let target = null
			const dummy = document.createElement('div')
			for (const marker of markers) {
				dummy.innerHTML = marker.tooltip
				const markerNation = dummy.textContent.match(/[Capital|Member] of (.*)\)/)?.[1].toLowerCase()
				if (markerNation == nation) target = marker
			}
			if (!target) return sendMessage('Searched nation has not been found.')
			let points = target.points.flat(Infinity)
			let coords = { x: points[0].x, z: points[0].z }
			location.search = `zoom=4&x=${coords.x}&z=${coords.z}&world=earthmc_moon`
			return
		} catch (_) {
			return null
		}
	}

	// api call
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

	// archive locator, data scraping
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
			let resList
			const townName = dummy.textContent.replaceAll('\n', '').trim().split(' ')[0]
			if (chosenArchiveDate < 20240623) {
				const membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
				resList = getStringBetween(dummy.textContent, membersTitle + ' ', 'Flags').toLowerCase().replaceAll(/ /g, '').split(',')
			} else {
				dummy.querySelector('summary').remove()
				resList = dummy.querySelector('details').textContent.replaceAll(/\t|\n| /g, '').trim().toLowerCase().split(',')
			}
			if (resList.includes(resident)) target = townName
		}

		if (!target) return sendMessage('Searched resident has not been found.')
		return locateTown(target)
	}

	// the moon locator, data scraping
	if (isMoon()) {
		try {
			let markers = await fetchJSON('https://map.earthmc.net/tiles/earthmc_moon/markers.json')
			markers = markers.data.find(layer => layer.id == 'towny').markers
			let target = null
			const dummy = document.createElement('div')
			for (const marker of markers) {
				dummy.innerHTML = marker.popup
				const townName = dummy.textContent.replaceAll('\n', '').trim().split(' ')[0]
				dummy.querySelector('summary').remove()
				const resList = dummy.querySelector('details').textContent.replaceAll(/\t|\n| /g, '').trim().toLowerCase().split(',')
				if (resList.includes(resident)) target = townName
			}

			if (!target) return sendMessage('Searched resident has not been found.')
			return locateTown(target)
		} catch (_) {
			return null
		}
	}

	// api call
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