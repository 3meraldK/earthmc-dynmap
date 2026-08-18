// Include @grant GM.xmlHttpRequest in userscript description!

async function corsFetch(url, options = null) {
    const json = {
        url: url,
        method: options?.method ?? 'GET',
        data: options?.body ?? undefined
    }
    let test = await GM.xmlHttpRequest(json)
    return test
}