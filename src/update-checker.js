function checkForUpdate() {
	const version = {
		cached: localStorage['emcdynmapplus-version'],
		latest: isExtension ? localStorage['emcdynmapplus-manifest-version'] : GM_info.script.version
	}
	if (!version.cached) return localStorage['emcdynmapplus-version'] = version.latest
	if (version.cached != version.latest) {
		const changelogURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
		sendMessage(`The extension has been automatically updated from ${version.cached} to ${version.latest}.
			Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.`)
	}
	localStorage['emcdynmapplus-version'] = version.latest
}