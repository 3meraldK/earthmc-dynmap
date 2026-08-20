function sendMessage(message) {
	if (document.querySelector('#message-box') != null) document.querySelector('#message-box').remove()
	document.documentElement.insertAdjacentHTML('beforeend', htmlCode.messageBox.replace('{message}', message))
	document.querySelector('#message-close').addEventListener('click', event => { event.target.parentElement.remove() })
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

// Requires @grant GM.xmlHttpRequest in userscript header
async function corsFetch(url, options = null) {
    const json = {
        url: url,
        method: options?.method ?? 'GET',
        data: options?.body ?? undefined
    }
    let test = await GM.xmlHttpRequest(json)
    return test
}

async function fetchJSON(url, options = null) {
	try {
		const response = isExtension ? await fetch(url, options) : await corsFetch(url, options)
		let data = null
		try {
			data = isExtension ? await response.json() : await JSON.parse(response.response)
		} finally {
			const isOK = isExtension ? response.ok : `${response.status}`.startsWith('2')
			return {ok: isOK, code: response.status, data: data}
		}
	} catch {
		return {ok: false, code: null, data: null}
	}
}