# earthmc-dynmapcolor
This Mozilla Firefox add-on enriches the EarthMC dynmap with a meganation support, i.e. now colors entire meganation the same color, and more.

# Download and use
This plugin is supported only on Mozilla Firefox due to Chromium limitations, however you may use [this userscript](https://github.com/32Vache/emc-map-colors) on Chromium browsers (MS Edge, Chrome).

1. Download the latest 'extension.zip' asset from [the release page](https://github.com/3meraldK/earthmc-dynmapcolor/releases).
2. In the normal browser, search "about:debugging#/runtime/this-firefox" and then load an add-on via the button, by selecting the file. The add-on will be usable on a one browser session meaning that you have to repeat this step every time you reopen the browser. This is an unsigned plugin.
3. However if you want to permanently install the extension, you may use the Firefox Developer Edition browser.
    1. Search "about:config", accept the prompt and search for 'xpinstall.signatures.required' and toggle the value to false.
    2. Restart the browser.
    3. Search "about:addons" and import the add-on from the file.
