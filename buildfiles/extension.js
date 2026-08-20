import AdmZip from 'adm-zip'
import { readdir, rm } from 'node:fs/promises'

// Delete dist/extension
await rm("dist/extension", { recursive: true, force: true })

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
const excludeFiles = ['\\.css', 'cors-bypass', 'userscript', 'assets', 'icon',
    'manifest', 'version-helper', 'interceptor', 'variables']
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

// write interceptor.js last
writer.write(await Bun.file('src/interceptor.js').text())
writer.end()

// save other files
for (const name of ['cors-bypass.js', 'manifest.json', 'version-helper.js']) {
    const file = Bun.file('src/extension/' + name)
    await Bun.write('dist/extension/' + name, file)
}
const icon = Bun.file('src/assets/icon.png')
await Bun.write('dist/extension/icon.png', icon)

let archive = new AdmZip()
archive.addLocalFolder('dist/extension')
archive.writeZip('dist/extension.zip')