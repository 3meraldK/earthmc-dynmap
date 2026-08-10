async function fetchJSON(url, options = null) {
	try {
		const response = await corsFetch(url, options)
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