let preventMapUpdate = false
unsafeWindow.fetch = async (...args) => { // unsafeWindow in userscript
	const response = await originalFetch(...args)

	const playerList = document.querySelector('fieldset#players')
	if (response.url.includes('players.json') && playerList) {
		const scroll = playerList.scrollTop
		setTimeout(() => playerList.scrollTop = scroll, 1)
	}

	if (response.url.includes('web.archive.org')) return response

	if (response.url.includes('markers.json') || response.url.includes('minecraft_overworld/settings.json')) {

		const modifiedJson = await response.clone().json().then(data => {

			if (response.url.includes('markers.json')) {
				if (preventMapUpdate == false) {
					preventMapUpdate = true
					return main(data)
				}
				else return null
			}

			if (response.url.includes('minecraft_overworld/settings.json')) return modifySettings(data)
		})
		return new Response(JSON.stringify(modifiedJson))

	}

	return response
}