function injectMainScript() {
	const mainScript = document.createElement('script')
	mainScript.src = chrome.runtime.getURL('main.js')
	mainScript.onload = function () { this.remove() };
	(document.head || document.documentElement).appendChild(mainScript)
}