function overrideZoomLimit() {
	const Leaflet = (typeof(unsafeWindow) != 'undefined') ? unsafeWindow.L : window.L
	Leaflet.Map.prototype.getMinZoom = function () { return -2 }

    const native_clampZoom = Leaflet.GridLayer.prototype._clampZoom
    Leaflet.GridLayer.prototype._clampZoom = function (zoom, ...args) {
        this.options.minZoom = -2
        return native_clampZoom.call(this, zoom, ...args)
    }

    const native_getTileUrl = Leaflet.TileLayer.prototype.getTileUrl
    Leaflet.TileLayer.prototype.getTileUrl = function (coords) {
        coords.z = Math.max(0, coords.z)
        return native_getTileUrl.call(this, coords)
    }
}