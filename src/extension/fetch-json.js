async function fetchJSON(url, options = null) {
	try {
		const response = await corsFetch(url, options)
		let data = null
		try { data = await response.json() }
		finally { return {ok: response.ok, code: response.status, data: data} }
	} catch {
		return {ok: false, code: null, data: null}
	}
}