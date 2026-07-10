async function addCountryLayer(data) {

	// Download & cache
	if (!await getOPFS('emcdynmapplus-borders')) {
		const prompt = addElement(document.body, htmlCode.promptBox.replace('{message}', 'Downloading country borders...'), '#prompt-box')
		const url = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/restructure/src/borders/country.json.gz'
		const layer = await fetchLayer(url)

		prompt.remove()
		if (!layer) {
			sendMessage('Could not download country borders layer, try again later.')
			return data
		}
		await saveToOPFS('emcdynmapplus-borders', JSON.stringify(layer))
	}

	// Add layer
	try {
		const layer = JSON.parse(await getOPFS('emcdynmapplus-borders'))
		data.push(layer)
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
		const url = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/restructure/src/borders/province.json.gz'
		const layer = await fetchLayer(url)

		prompt.remove()
		if (!layer) {
			sendMessage('Could not download province borders layer, try again later.')
			return data
		}
		await saveToOPFS('emcdynmapplus-borders-provinces', JSON.stringify(layer))
	}

	// Add layer
	try {
		const layer = JSON.parse(await getOPFS('emcdynmapplus-borders-provinces'))
		data.push(layer)
		return data
	} catch (error) {
		sendMessage(`Could not set up a layer of province borders. You may need to clear this website's data.`)
		return data
	}
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