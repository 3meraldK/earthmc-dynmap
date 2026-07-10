function millerProjection(z, northHemisphereFactor = 0.994) {
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
						x: Math.round(line.x[x] * 1.94133 + 382.5),
						z: Math.round(millerProjection(line.z[x]) + 8175)
					}
				} else {
					newCoords = {
						x: Math.round(line.x[x] * 1.0015),
						z: Math.round(line.z[x])
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

async function addProvinceLayer(data) {

	// Download & cache
	if (!await getOPFS('emcdynmapplus-borders-provinces')) {
		const prompt = addElement(document.body, htmlCode.promptBox.replace('{message}', 'Downloading province borders...'), '#prompt-box')
		const downloadURL = 'https://web.archive.org/web/2id_/https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/refs/heads/restructure/province-borders.geojson.gz'

		const json = {
			url: downloadURL,
			method: 'GET',
			responseType: 'blob'
		}
		const response = await GM.xmlHttpRequest(json)
		let borders = null
		let ok = false
		try { borders = await response.response }
		finally { ok = `${response.status}`.startsWith('2') }

		const blobAsStream = borders.stream().pipeThrough(new DecompressionStream('gzip'))
    	const blob = await new Response(blobAsStream).blob()
		borders = JSON.parse(await blob.text())
		let features = borders.features

		prompt.remove()
		if (!ok || !features) {
			sendMessage('Could not download province borders layer, try again later.')
			return data
		}

		features = features.filter(feature => feature.type == 'Feature')
		let geometries = features.map(feature => feature.geometry)
		geometries = geometries.filter(geometry => geometry.type == 'Polygon' || geometry.type == 'MultiPolygon')
		await saveToOPFS('emcdynmapplus-borders-provinces', JSON.stringify(geometries))
	}

	try {
		// Create

		const points = []
		let geometries = JSON.parse(await getOPFS('emcdynmapplus-borders-provinces'))
		
		let newGeometries = []
		for (const geometry of geometries) {
			if (geometry.type == 'Polygon') {
				newGeometries.push(geometry.coordinates.flat())
			} else {
				for (const splitGeometry of geometry.coordinates.flat())
				newGeometries.push(splitGeometry)
			}
		}

		let theMap = []
		for (const geometry of newGeometries) {
			let smth = []
			for (const coords of geometry) {
				let x = coords[0] * 1
				let z = coords[1] * -1
				x = ((x - -180) * (64512 - -64512) / (180 - -180) + -64512)
				z = ((z - -90) * (16512 - -16640) / (90 - -90) + -16640)
				z = millerProjection(z, 0.9976) + 8175 - 200
				let obj = {x: Math.round(x), z: Math.round(z)}
				smth.push(obj)
			}
			theMap.push(smth)
		}

		data.push({
			hide: true,
			name: 'Province Borders',
			control: true,
			id: 'province-borders',
			order: 998,
			markers: [{
				weight: 1,
				color: '#ffffff',
				type: 'polyline',
				points: theMap
			}]
		})
		return data
	} catch (error) {
		sendMessage(`Could not set up a layer of province borders. You may need to clear this website's data.`)
		console.error(error)
		return data
	}
}