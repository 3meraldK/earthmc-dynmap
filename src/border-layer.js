function millerProjection(z) {
	// -16640 and 16508 are vertical bounds of old map (Plate Carree projection)
	// Assume old map covers every latitude
	// Convert old (Aurora) map's Z-coord to latitude
	const latDeg = (z - -16640) * (90 - -90) / (16508 - -16640) + -90
	const latRad = latDeg * (Math.PI / 180)

	// 2.304 is a magic number from 5/4 * Math.asinh(Math.tan(4/5 * (90 * (Math.PI / 180))))
	// 16574 is a mean average of old map vertical bounds
	const multiplier = 16574 / 2.3034125433763912

	// project from Plate Carree to Miller Cylindrical
	// Adjust projection of north hemisphere
	const northHemisphereFactor = 0.994
	let millerOldZ = 5/4 * Math.asinh(Math.tan(4/5 * latRad)) * multiplier
	if (millerOldZ < 0) millerOldZ *= northHemisphereFactor

	// 33148 is height of old map
	// 94704 is estimated height of new (Nostra) map if it wasn't cropped
	const scale = 94704 / 33148

	return millerOldZ * scale
}

async function addCountryLayer(data) {

	// Download & cache
	if (!await getOPFS('emcdynmapplus-borders')) {
		const prompt = addElement(document.body, htmlCode.promptBox.replace('{message}', 'Downloading country borders...'), '#prompt-box')
		const markersURL = 'https://web.archive.org/web/2024id_/https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json'

		let fetch = await fetchJSON(markersURL)

		prompt.remove()
		if (!fetch.ok || !fetch.data) {
			sendMessage('Could not download country borders layer, try again later.')
			return data
		}
		await saveToOPFS('emcdynmapplus-borders', JSON.stringify(fetch.data.sets['borders.Country Borders'].lines))
	}

	try {
		// Assemble
		const points = []
		const countries = JSON.parse(await getOPFS('emcdynmapplus-borders'))
		for (const line of Object.values(countries)) {
			const linePoints = []
			for (const x in line.x) {
				if (isNaN(parseInt(line.x[x]))) continue

				// Hand-picked constants
				// 1.94 is how many times Nostra map horizontally bigger is than Aurora's
				// 382.5 is to how much to move layer to right by
				// 8175 ... same as above but move down
				// 1.0015 is a horizontal adjustment for Aurora map
				let newCoords
				if (isNostra) {
					newCoords = {
						x: line.x[x] * 1.94133 + 382.5,
						z: millerProjection(line.z[x]) + 8175
					}
				} else {
					newCoords = {
						x: line.x[x] * 1.0015,
						z: line.z[x]
					}
				}
				linePoints.push(newCoords)
			}
			points.push(linePoints)
		}

		// Create
		data.push({
			hide: true,
			name: 'Country Borders',
			control: true,
			id: 'borders',
			order: 999,
			markers: [{
				weight: 1,
				color: '#ffffff',
				type: 'polyline',
				points: points
			}]
		})
		return data
	} catch (error) {
		sendMessage(`Could not set up a layer of country borders. You may need to clear this website's data.`)
		return data
	}
}