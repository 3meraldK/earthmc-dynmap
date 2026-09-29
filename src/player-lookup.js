async function lookupPlayer(player, showOnlineStatus = true) {

	if (document.querySelector('#player-lookup') != null) document.querySelector('#player-lookup').remove()
	if (document.querySelector('#player-lookup-loading') != null) document.querySelector('#player-lookup-loading').remove()
	const loading = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookupLoading, '#player-lookup-loading')

	let allReq = await fetchJSON(apiURL + '/players')
    if (!allReq.ok) {
		loading.remove()
		return sendMessage('Info can not be retrieved right now, try later.')
	}
    let req = await fetchJSON(apiURL + '/players', {method: 'POST', body: JSON.stringify({query: [player]})})
    let exists = allReq.data.map(it => it.name).includes(player)
    if (!exists && !req.ok) {
		loading.remove()
		return sendMessage('This player does not exist.') // shouldn't happen
	}
    if (!req.ok) {
		loading.remove()
		return sendMessage('This player opted out of being searched.')
	}
    let data = req.data[0]
    if (data.status.isNPC) {
		loading.remove()
		return sendMessage('This player is an NPC.')
	}

	loading.remove()
	const lookup = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookup, '#player-lookup')

	// Populate with placeholders
	lookup.insertAdjacentHTML('beforeend', '{show-online-status}<br>')
	lookup.insertAdjacentHTML('beforeend', '<img id="player-lookup-avatar"/>')
	lookup.insertAdjacentHTML('beforeend', '<center><b id="player-lookup-name">{player}</b>{about}</center>')
	lookup.insertAdjacentHTML('beforeend', '<hr>{town}{nation}')
	lookup.insertAdjacentHTML('beforeend', 'Rank: <b>{rank}</b><br>')
	lookup.insertAdjacentHTML('beforeend', 'Balance: <b>{balance} gold</b><br>')
	lookup.insertAdjacentHTML('beforeend', '{last-online}')
	lookup.insertAdjacentHTML('beforeend', '<span class="close-container">×</span>')

	// Gather data
	const isOnline = data.status.isOnline
	const balance = data.stats.balance
	const town = data.town.name
	const nation = data.nation.name
	const lastOnline = new Date(data.timestamps.lastOnline).toLocaleDateString('fr')
	let onlineStatus = '<span id="player-lookup-online" style="color: {online-color}">{online}</span>'
	const about = (!data.about || data.about == '/res set about [msg]') ? '' : `<br><i>${data.about}</i>`
	let rank = 'Townless'
	if (data.status.hasTown) rank = 'Resident'
	if (data.ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (data.status.isMayor) rank = 'Mayor'
	if (data.ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (data.status.isKing) rank = 'Leader'

	// Modify HTML
	const playerAvatarURL = 'https://mc-heads.net/avatar/' + data.uuid.replaceAll('-', '')
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player)
		.replace('{about}', about)
		.replace('{show-online-status}', showOnlineStatus ? onlineStatus : '')
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{town}', town ? `Town: <b>${town}</b><br>` : '')
		.replace('{nation}', nation ? `Nation: <b>${nation}</b><br>` : '')
		.replace('{rank}', rank)
		.replace('{balance}', balance)
		.replace('{last-online}', !isOnline ? `Last online: <b>${lastOnline}</b><br>` : '')
	lookup.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })

	// Enable scrolling the about section
	lookup.querySelector('center > i')?.addEventListener('wheel', (event) => {event.stopImmediatePropagation()})
}

// Clickable player nameplates
waitForHTMLelement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) lookupPlayer(username, false)
	})
})