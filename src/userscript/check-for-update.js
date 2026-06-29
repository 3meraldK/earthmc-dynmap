async function checkForUpdateUserscript(parent) {
	const localVersion = GM_info.script.version
	const manifest = await fetchJSON('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/manifest.json')
	if (!manifest.ok) return console.log('EarthMC Dynmap+ could not check for update.')
	const latestVersion = manifest?.data?.version
	if (!latestVersion || latestVersion == localVersion) return
	parent.insertAdjacentHTML('beforeend', htmlCode.updateNotification)
	const updateNotification = parent.querySelector('#update-notification')
	const repoURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
	const text = `EarthMC Dynmap+ update from ${localVersion} to ${latestVersion} is available. <a id="update-download-link" target="_blank" href="${repoURL}">Click here to download!</a>`
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{text}', text)
	updateNotification.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}