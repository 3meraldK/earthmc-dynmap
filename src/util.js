function sendMessage(message) {
	if (document.querySelector('#message-box') != null) document.querySelector('#message-box').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.messageBox.replace('{message}', message))
	document.querySelector('#message-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

function waitForHTMLelement(selector) {
	return new Promise(resolve => {
		if (document.querySelector(selector)) {
			return resolve(document.querySelector(selector))
		}

		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) {
				resolve(document.querySelector(selector))
				observer.disconnect()
			}
		})
		observer.observe(document.body, { childList: true, subtree: true })
	})
}

function addElement(parent, element, returnWhat, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(returnWhat) : parent.querySelectorAll(returnWhat)
}

async function saveToOPFS(file, text) {
	const fileSystem = await navigator.storage.getDirectory()
	let fileHandle = await fileSystem.getFileHandle(file, {create: true})
	const writable = await fileHandle.createWritable()
	await writable.write(text)
	await writable.close()
}

async function getOPFS(filename) {
	try {
		const fileSystem = await navigator.storage.getDirectory()
		let fileHandle = await fileSystem.getFileHandle(filename)
		const file = await fileHandle.getFile()
		return await file.text()
	} catch (e) {
		return null
	}
}

function roundTo16(number) {
	return Math.round(number / 16) * 16
}

// Fowler-Noll-Vo hash function
function hashCode(string) {
	let hexValue = 0x811c9dc5
	for (let i = 0; i < string.length; i++) {
		hexValue ^= string.charCodeAt(i)
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24)
	}
	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0')
}

// Shoelace formula
function getArea(vertices) {
	const n = vertices.length
	let area = 0

	// Data has imprecise coordinates; round vertices to 16
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n
		area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
		area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
	}

	return (Math.abs(area) / 2) / (16 * 16)
}

// By James Halliday (substack)
function pointInPolygon(vertex, polygon) {
	let x = vertex.x, z = vertex.z
	let n = polygon.length
	let inside = false
	for (let i = 0, j = n - 1; i < n; j = i++ ) {
		let xi = polygon[i].x
		let zi = polygon[i].z
		let xj = polygon[j].x
		let zj = polygon[j].z

		let intersect = ((zi > z) != (zj > z))
			&& (x < (xj - xi) * (z - zi) / (zj - zi) + xi)
		if (intersect) inside = !inside
	}
	return inside
}