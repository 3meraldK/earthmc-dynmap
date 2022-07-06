var mapMode = 'mega';

const createRule = (id, action, filter) => ({
	'id': id,
	'priority': 1,
	'action': {'type': 'redirect', "redirect": { "url": action }},
	'condition': {
		'urlFilter': filter,
		'resourceTypes': ['main_frame', 'xmlhttprequest']
	}
});

// Method for updating rules.
function updateRules(mode) {
	chrome.declarativeNetRequest.updateDynamicRules({
		addRules: [
			createRule(1, getURL('nova'), getFilter('nova')),
			createRule(2, getURL('nova', mode), getFilter('nova', mode)),
			createRule(3, getURL('aurora'), getFilter('aurora')),
			createRule(4, getURL('aurora', mode), getFilter('aurora', mode))
		], removeRuleIds: [1, 2, 3, 4]
	});
}

// Utility method for URLs.
const getURL = (world, type = 'update') => type == 'update' ? 
	  `https://earthmc-api.herokuapp.com/api/v1/${world}/update` :
	  `https://earthmc-api.herokuapp.com/api/v1/${world}/markers/${type}`;

const getFilter = (world, type = 'update') => type == 'update' ? 
	  `https://earthmc.net/map/${world}/up/world/earth/*` : 
	  `https://earthmc.net/map/${world}/tiles/_markers_/marker_earth.json`;

// Redirecting system.
const onMessage = (event) => {
	if (event.message == 'Button clicked') {
		mapMode = mapMode == 'mega' ? 'pact' : 'mega';
		updateRules(mapMode);
	}
	else if (event.message == 'Database fetched') updateRules(mapMode);
	else chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: [1, 2, 3, 4]});
}

chrome.runtime.onMessage.addListener(onMessage);
updateRules(mapMode);
