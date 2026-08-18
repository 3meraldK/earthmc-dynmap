let url, bounds
const isAurora = location.href.includes('aurora')
const SCALE = 0.03125
const world = localStorage['emcdynmapplus-archive-mode-world']
const mode = localStorage['emcdynmapplus-mapmode']
const isDarkened = localStorage['emcdynmapplus-darkened'] == 'true'

if (world == 'Terra Nova' || world == 'Terra Aurora') {
	url = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/restructure/src/assets/basemap-aurora.png'
	bounds = {down: -16508, left: -33280, up: 16640, right: 33080}
} else if (world == 'Classic') {
	url = 'https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/restructure/src/assets/basemap-classic.png'
	bounds = {down: 1023, left: -1535, up: -14335, right: 19455}
}

if (mode == 'archive' && world != 'Terra Nostra' && !isAurora) hookLeaflet()

function hookLeaflet() {
    if (typeof(L) == 'undefined') return requestAnimationFrame(hookLeaflet)
    const originalMap = L.map
    L.map = function (...args) {
        const squaremap = originalMap.apply(this, args)
        L.imageOverlay(url, [
            [bounds.down * SCALE, bounds.left * SCALE],
            [bounds.up * SCALE, bounds.right * SCALE],
        ]).addTo(squaremap)
        waitForHTMLelement('.leaflet-image-layer').then((element) => {
            element.style.filter = isDarkened ? 'brightness(50%)' : ''
        })
		document.querySelector('.leaflet-tile-pane').remove()
        return squaremap
    }
}