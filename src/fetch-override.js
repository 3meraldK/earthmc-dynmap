// Replace the default fetch() with ours to intercept responses
let preventMapUpdate = false
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