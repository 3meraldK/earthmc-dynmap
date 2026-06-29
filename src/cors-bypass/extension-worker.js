/* Utility function */
async function getCurrentURL() {
	return new Promise((resolve, reject) => {
        chrome.tabs.query({lastFocusedWindow: true, active: true}, (tabs) => {
            if (!tabs[0]?.url) return resolve(null)
            try {
                let url = new URL(tabs[0].url)
                resolve(url.origin)
            } catch (error) { reject(error) }
        })
    })
}

/* Main function */
async function update() {
	const url = await getCurrentURL()
	console.log(url)
	if (url != 'https://aurora.earthmc.net' && url != 'https://map.earthmc.net') {
		return chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
			addRules: []
		})
	}
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'Access-Control-Allow-Origin', operation: 'set', value: url },
                    { header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET, POST, OPTIONS' },
                    { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' }
                ]
            },
			"condition": { "resourceTypes": ["xmlhttprequest"] }
        }]
    })
}

/* Event listeners */
chrome.tabs.onUpdated.addListener(async () => await update())
chrome.tabs.onActivated.addListener(async () => await update())