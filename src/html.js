const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
	partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayerFunc(\'{player}\')">{player}</span>', // Different onclick functions in userscript and extension
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
	promptBox: '<div id="prompt-box"><p id="message">{message}</p></div>',
	buttons: {
		locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
		searchArchive: '<button class="sidebar-button" id="archive-button">Search archive</button>',
		options: '<button class="sidebar-button" id="options-button">Options</button>',
		switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>',
		togglePlayerList: '<button class="sidebar-input" id="toggle-player-list">Toggle player list</button>'
	},
	options: {
		menu: '<div id="options-menu"></div>',
		option: '<div class="option"></div>',
		label: '<label for="{option}">{optionName}</label>',
		checkbox: '<input id="{option}" type="checkbox" name="{option}">',
		archiveWorldMode: '<select id="archive-mode-world"><option value="" selected disabled hidden>{current}</option><option>Classic</option><option>Terra Nova</option><option>Terra Aurora</option><option>Terra Nostra</option></select>'
	},
	sidebar: '<div class="leaflet-control-layers leaflet-control" id="emcdynmapplus-sidebar"></div>',
	sidebarOption: '<div class="sidebar-option"></div>',
	locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
	locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
	archiveInput: '<input class="sidebar-input" id="archive-input" type="date">',
	currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
	followingPlayer: '<h1 id="followingWarning">Click on map to unfollow player</h1>',
    messageBox: '<div id="message-box"><p id="message">{message}</p><br><button id="message-close">OK</button></div>',
	updateNotification: '<div class="leaflet-control-layers leaflet-control left-container" id="update-notification">{text}<br><span class="close-container">×</span></div>' // Exclusively for userscript
}