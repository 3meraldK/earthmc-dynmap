function tick() {
    const isFollowingPlayer = document.querySelector('.following') != null
    document.querySelector('#followingWarning').style.display = isFollowingPlayer ? 'unset' : 'none'
    requestAnimationFrame(tick)
}

function addPlayerList() {
	waitForHTMLelement('#players').then(() => {
		const playerList = document.getElementById('players')
		const mapElement = document.getElementById('map')
		mapElement.appendChild(playerList)
		playerList.addEventListener('wheel', (event) => {event.stopImmediatePropagation()})
	})
	addElement(document.body, htmlCode.followingPlayer, '#followingWarning')
}