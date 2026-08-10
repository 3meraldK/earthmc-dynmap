import { readdir } from "node:fs/promises"

const userscript = Bun.file('dist/userscript.user.js')
userscript.write('')
const writer = userscript.writer()

// write the header and variables first in
const header = await Bun.file('src/userscript/header.js').text()
const variables = await Bun.file('src/variables.js').text()
writer.write(header + '\n\n')
writer.write(variables + '\n\n')

// write styles in
const styles = (await readdir('src/css')).filter(file => !file.match(/dark-mode/))
writer.write('const css = `')
for (const path of styles) {
    const text = await Bun.file('src/css/' + path).text()
    writer.write(text + '\n\n')
}
writer.write('`\n\n')

// write code in
const code = (await readdir('src', {recursive: true}))
    .filter(file => !file.match(/\.css|extension|borders|variables|header|fetch-override/) && file.includes('.'))
const darkMode = await Bun.file('src/css/dark-mode.css').text()
for (const path of code) {
    let text = await Bun.file('src/' + path).text()
    text = text.replace('{dark-mode.css}', darkMode)
    writer.write(text + '\n\n')
}

// write fetch-override.js in as last
writer.write(await Bun.file('src/fetch-override.js').text())
writer.end()

writer.end()