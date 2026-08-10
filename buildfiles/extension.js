import AdmZip from 'adm-zip'
import { readdir } from 'node:fs/promises'

// write styles into style.css
const styles = (await readdir('src/css'))
    .filter(file => !file.match(/dark-mode/))
const style = Bun.file('dist/extension/style.css')
style.write('')
let writer = style.writer()
for (const path of styles) {
    const text = await Bun.file('src/css/' + path).text()
    writer.write(text + '\n\n')
}
writer.end()

// write code into main.js
const main = Bun.file('dist/extension/main.js')
main.write('')
writer = main.writer()

// write variables.js first
const variables = await Bun.file('src/variables.js').text()
writer.write(variables + '\n\n')

// rest of code
const code = (await readdir('src', {recursive: true}))
    .filter(file => !file.match(/\.css|extension-worker|userscript|borders|icon|manifest|version-check|fetch-override|variables/) && file.includes('.'))
const darkMode = await Bun.file('src/css/dark-mode.css').text()
for (const path of code) {
    let text = await Bun.file('src/' + path).text()
    text = text.replace('{dark-mode.css}', darkMode) // inject dark mode style into code
    text = text.replace('onclick="lookupPlayerFunc', 'onclick="lookupPlayer') // call valid function
    writer.write(text + '\n\n')
}

// write fetch-override.js last
writer.write(await Bun.file('src/fetch-override.js').text())
writer.end()

// save other files
const icon = Bun.file('src/extension/icon.png')
const worker = Bun.file('src/cors-bypass/extension-worker.js')
const manifest = Bun.file('src/extension/manifest.json')
const versionCheck = Bun.file('src/extension/version-check.js')
await Bun.write('dist/extension/worker.js', worker)
await Bun.write('dist/extension/manifest.json', manifest)
await Bun.write('dist/extension/version-check.js', versionCheck)
await Bun.write('dist/extension/icon.png', icon)

let archive = new AdmZip()
archive.addLocalFolder('dist/extension')
archive.writeZip('dist/extension.zip')