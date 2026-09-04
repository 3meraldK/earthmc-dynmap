function modifyDescription(marker) {
	// Gather some information
	const town = marker.tooltip.match(/<b>(.*)<\/b>/)[1]
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	let councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1].split(', ')
	councillors = councillors.filter(councillor => councillor != 'None')
	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents.split(', ').length
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null

	// Town's area
	let area = 0
	const iteratedRegions = []
	if (marker.type == 'polygon') {
		for (const regionVertices of marker.points[0]) {

			// Exclude non-affiliated regions entirely inside town
			if (iteratedRegions.length > 0) {
				let isInsidePolygon = false
				for (const vertex of regionVertices) {
					for (const lastPolygon of iteratedRegions) {
						if (pointInPolygon(vertex, lastPolygon)) isInsidePolygon = true
					}
				}
				if (isInsidePolygon) area -= getArea(regionVertices)
				else area += getArea(regionVertices)
			}
			else area += getArea(regionVertices)
			iteratedRegions.push(regionVertices)

		}
	}

	// Resident lists
	const residentList = (currentMapMode == 'archive' || !isNostra) ? residents :
		residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorList = (currentMapMode == 'archive' || !isNostra) ? councillors :
		councillors.map(councillor => htmlCode.residentClickable.replaceAll('{player}', councillor)).join(', ')

	// Modify resident list
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, htmlCode.scrollableResidentList.replace('{list}', residentList))
	} else {
		marker.popup = marker.popup.replace(residents + '\n', htmlCode.residentList.replace('{list}', residentList) + '\n')
	}

	if (currentMapMode != 'archive' && isNostra) {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`)
		if (councillors.length > 0) {
			marker.popup = marker.popup.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`)
		}
	}

	// Names wrapped in angle brackets
	const names = {
		town: town.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
		nation: nation?.replaceAll('<', '&lt;').replaceAll('>', '&gt;') ?? nation
	}

	marker.popup = marker.popup
		.replace(town, names.town)
		.replace(nation, names.nation)
		.replace('</details>\n   \t<br>', '</details>')
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`)
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<i></i> \n    <br>\n', '')
		.replace('\n    <i>', '\n    <i style="overflow-wrap: break-word">')
		.replace('Councillors: <b>None</b>\n\t<br>', '')
		.replace('Size: <b>0 chunks</b><br/>', '')
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>')
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>')
	if (isCapital) marker.popup = marker.popup
		.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">★ ')

	// Modify tooltip
	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')
		.replace('\n    <i>', '\n    <i id="clamped-board">')
		.replace(town, names.town)
		.replace(nation, names.nation)

	// 'Part of' label
	if (currentMapMode == 'archive' || currentMapMode == 'default') return marker
	const nationAlliances = getNationAlliances(nation)
	if (nationAlliances.length > 0) {
		const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
		const partOfLabel = htmlCode.partOfLabel.replace('{allianceList}', allianceList)
		marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
	}

	return marker
}