const currentVersion = chrome.runtime.getManifest().version
localStorage['emcdynmapplus-version-old'] = localStorage['emcdynmapplus-version'] ?? currentVersion
localStorage['emcdynmapplus-version'] = currentVersion