async function fetchJSON(url, options = null) {
	try {
		const response = await corsFetch(url, options)
		let data = null
		try { data = await JSON.parse(response.response) }
		finally { return {ok: `${response.status}`.startsWith('2'), code: response.status, data: data} }
	} catch {
		return {ok: false, code: null, data: null}
	}
}