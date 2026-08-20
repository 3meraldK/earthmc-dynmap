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
const excludeFiles = ['\\.css', 'extension-worker', 'userscript', 'assets', 'icon',
    'manifest', 'version-helper', 'fetch-override', 'variables']
const regex = new RegExp(excludeFiles.join('|'))
const code = (await readdir('src', {recursive: true}))
    .filter(file => !file.match(regex) && file.includes('.'))
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
for (const name of ['icon.png', 'manifest.json', 'version-helper.js']) {
    const file = Bun.file('src/extension/' + name)
    await Bun.write('dist/extension/' + name, file)
}
const worker = Bun.file('src/cors-bypass/extension-worker.js')
await Bun.write('dist/extension/worker.js', worker)

let archive = new AdmZip()
archive.addLocalFolder('dist/extension')
archive.writeZip('dist/extension.zip')