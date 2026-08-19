function checkForUpdate() {
	const variableName = isExtension ? 'emcdynmapplus-version-old' : 'emcdynmapplus-version'
	const version = {
		cached: localStorage[variableName],
		latest: isExtension ? localStorage['emcdynmapplus-version'] : GM_info.script.version
	}
	if (!version.cached) return localStorage['emcdynmapplus-version'] = version.latest
	if (version.cached != version.latest) {
		const changelogURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
		sendMessage(`Extension has been automatically updated from ${version.cached} to ${version.latest}.
			Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.`)
	}
	localStorage['emcdynmapplus-version'] = version.latest
}