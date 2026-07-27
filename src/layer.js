async function addBordersLayer(data) {
	for (const type of ['country', 'province']) {
		// Download & cache
		if (!await getOPFS('emcdynmapplus-borders-' + type)) {
			const prompt = addElement(document.body, htmlCode.promptBox.replace('{message}', `Downloading ${type} borders...`), '#prompt-box')
			const url = `https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/restructure/src/borders/${type}.json.gz`
			const layer = await fetchLayer(url)

			prompt.remove()
			if (!layer) {
				sendMessage(`Could not download ${type} borders layer, try again later.`)
				continue
			}
			await saveToOPFS('emcdynmapplus-borders-' + type, JSON.stringify(layer))
		}

		// Add layer
		try {
			const layer = JSON.parse(await getOPFS('emcdynmapplus-borders-' + type))
			data.push(layer)
			continue
		} catch (error) {
			sendMessage(`Could not set up a layer of ${type} borders. You may need to clear this website's data.`)
			continue
		}
	}
	return data
}

async function fetchLayer(url) {
	try {
		const options = { url: url, method: 'GET', responseType: 'arraybuffer' }
		const response = await GM.xmlHttpRequest(options)
		const gzip = response.response
		const stream = new Response(gzip).body.pipeThrough(new DecompressionStream('gzip'))
		const text = await new Response(stream).text()
		const layer = JSON.parse(text)
		return layer
	} catch (error) {
		return null
	}
}

function addChunksLayer(data) {
	const chunkLines = []
	for (let x = -33280; x <= 33088; x += 16) {
		chunkLines.push([
			{ x: x, z: -16640 },
			{ x: x, z: +16512 },
			{ x: x, z: -16640 }
		])
	}
	for (let z = -16640; z <= 16512; z += 16) {
		chunkLines.push([
			{ x: -33280, z: z },
			{ x: +33088, z: z },
			{ x: -33280, z: z }
		])
	}

	data.push({
		hide: true,
		name: 'Chunks',
		control: true,
		id: 'chunks',
		markers: [{
			weight: 0.33,
			color: '#000000',
			type: 'polyline',
			points: chunkLines
		}]
	})
	return data
}