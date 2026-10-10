const isLegacy = location.href.includes('legacy')

if (!isLegacy) {
    if (!localStorage['emcdynmapplus-legacy-first-time']) {
        sendMessage(`<h3 style="color:black !important">Warning!</h3>
            Due to an unexpected EarthMC map update by staff, EarthMC Dynmap+ will temporarily only work on 
            <a target="_blank" href="https://legacymap.earthmc.net">https://legacymap.earthmc.net</a> <b>until it gets fixed</b>!
            Check <a target="_blank" href="https://discord.gg/AVtgkcRgFs">here</a> for further announcements. This message will be displayed <b>only once</b>.`)
        localStorage['emcdynmapplus-legacy-first-time'] = 'false'
    }
    waitForHTMLelement('div[aria-label="World"]').then(elem => {
        elem.insertAdjacentHTML('beforebegin', '<button id="legacy-redirect">Redirect to legacy map for extension to work</button>')
        document.querySelector('#legacy-redirect').onclick = () => location.href = 'https://legacymap.earthmc.net'
    })
}