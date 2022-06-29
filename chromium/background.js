let mapMode = 'mega';

// Method for updating rules.
const updateRules = (mode) => {
	chrome.declarativeNetRequest.updateDynamicRules({
		addRules: [{
			'id': 1,
			'priority': 1,
			'action': {'type': 'redirect', "redirect": {"url": getURL('nova', mode)}},
			'condition': {
				'urlFilter': 'https://earthmc.net/map/nova/tiles/_markers_/marker_earth.json',
				'resourceTypes': ['main_frame', 'xmlhttprequest']
			}
		},
		{
			'id': 2,
			'priority': 1,
			'action': {'type': 'redirect', "redirect": {"url": getURL('aurora', mode)}},
			'condition': {
				'urlFilter': 'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json',
				'resourceTypes': ['main_frame', 'xmlhttprequest']
			}
		},
		{
			'id': 3,
			'priority': 1,
			'action': {'type': 'redirect', "redirect": {"url": getURL('nova')}},
			'condition': {
				'urlFilter': 'https://earthmc.net/map/nova/up/world/earth/*',
				'resourceTypes': ['main_frame', 'xmlhttprequest']
			}
		},
		{
			'id': 4,
			'priority': 1,
			'action': {'type': 'redirect', "redirect": {"url": getURL('aurora')}},
			'condition': {
				'urlFilter': 'https://earthmc.net/map/aurora/up/world/earth/*',
				'resourceTypes': ['main_frame', 'xmlhttprequest']
			}
		}],
		removeRuleIds: [1, 2, 3, 4]
	});
}

// Utility method for URLs.
const getURL = (world, type = 'update') => {
	if (type == 'update') return `https://earthmc-api.herokuapp.com/api/v1/${world}/update`;
	return `https://earthmc-api.herokuapp.com/api/v1/${world}/markers/${type}`;
}

// Redirecting system.
const onMessage = (message) => {
	if (message.message == 'Button clicked') {
		mapMode == 'mega' ? mapMode = 'pact' : mapMode = 'mega';
		updateRules(mapMode); }
	else if (message.message == 'Database fetched')  {updateRules(mapMode);} 
	else chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: [1, 2, 3, 4]});
	
};
chrome.runtime.onMessage.addListener(onMessage);
updateRules(mapMode);