// Replace the default fetch() with ours to intercept responses
const actualWindow = isExtension ? window : unsafeWindow
actualWindow.fetch = async (...args) => {
	const response = await originalFetch(...args)

	const playerList = document.querySelector('fieldset#players')
	if (response.url.includes('players.json') && playerList) {
		const scroll = playerList.scrollTop
		const observer = new MutationObserver(() => {
			playerList.scrollTop = scroll
			observer.disconnect()
		})
    	observer.observe(playerList, { childList: true, subtree: true })
	}

	if (response.url.includes('web.archive.org')) return response

	if (response.url.match(/markers|(minecraft_overworld|earthmc_moon)\/settings/)) {
		let isMoon = response.url.includes('earthmc_moon')
		const modifiedJson = await response.clone().json().then(data => {
			if (response.url.includes('markers.json')) return main(data, isMoon)
			if (response.url.includes('settings.json')) return modifySettings(data, isMoon)
		})
		return new Response(JSON.stringify(modifiedJson))
	}

	return response
}