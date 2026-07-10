async function getTownSpawn(town) {
	// Archive mode works with towns only
	if (currentMapMode == 'archive') {
		const markersURL = getArchiveURL()

		let archive = await fetchJSON(markersURL)

		if (!archive.ok) return null
		if (!archive.data) return false

		archive = {data: [{markers: []}]}

		if (chosenArchiveDate < 20200322) {
			archive.data[0].markers = convertOldMarkersStructure(archive.data.sets['towny.markerset'])
		} else if (chosenArchiveDate < 20240623) {
			// TODO: Fix Cannot read properties of undefined (reading 'townyPlugin.markerset') (tested for locating London in archive mode, 2024-05-31)
			archive.data[0].markers = convertOldMarkersStructure(archive.data.sets['townyPlugin.markerset'])
		}

		let townObject = archive.data[0].markers.find(el => el.popup.toLowerCase().includes(`>${town} (`))
		if (!townObject) return false
		let points = townObject.points.flat(Infinity)
		let coords = { x: points[0].x, z: points[0].z }
		return coords
	}
	const query = { query: [town], template: { coordinates: true } }
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
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`

}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	if (currentMapMode == 'archive') {
		return sendMessage(`Can't search for archived nations. Exit archive mode to proceed.`)
	}

	const query = { query: [nation], template: { capital: true } }
	const data = await fetchJSON(apiURL + '/nations', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')
	if (!data.data) return sendMessage('Searched nation has not been found.')

	let capital
	try { capital = data.data[0].capital.name }
	catch { return sendMessage('Searched nation has not been found.') }
	const coords = await getTownSpawn(capital)
	if (coords == false) return sendMessage('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	if (currentMapMode == 'archive') {
		return sendMessage(`Can't search for archived residents. Exit archive mode to proceed.`)
	}

	const query = { query: [resident], template: { town: true } }
	const data = await fetchJSON(apiURL + '/players', {method: 'POST', body: JSON.stringify(query)})
	if (!data.ok) return sendMessage('Service is currently unavailable, please try later.')

	try {
		const town = data.data[0].town.name
		const coords = await getTownSpawn(town)
		if (coords == false) return sendMessage('Unexpected error occurred while searching for resident, please try later.')
		if (coords == null) return sendMessage('Service is currently unavailable, please try later.')
		location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
	} catch {
		return sendMessage(`The searched resident is townless or they opted out of being looked up.`)
	}
}

function locate(selectValue, inputValue) {
	if (!isNostra) return sendMessage(`Can't locate in this world.`)
	switch (selectValue) {
		case 'Town': locateTown(inputValue); break
		case 'Nation': locateNation(inputValue); break
		case 'Resident': locateResident(inputValue); break
	}
}