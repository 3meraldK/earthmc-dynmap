import { readdir } from "node:fs/promises"

const output = Bun.file('dist/userscript.js')
output.write('')
const writer = output.writer()

// Insert header and variables first
const header = Bun.file('src/userscript/header.js')
const variables = Bun.file('src/variables.js')
const headerText = await header.text()
const headerVariables = await variables.text()
writer.write(headerText + '\n\n')
writer.write(headerVariables + '\n\n')

// Insert css files
const cssFiles = await readdir('src/css/')
writer.write('const css = `')
for (const i in cssFiles) {
    const file = Bun.file('src/css/' + cssFiles[i])
    if (file.type == 'application/octet-stream') continue
    const content = await file.text()
    writer.write(content)
    if (i != cssFiles.length-1) writer.write('\n\n')
}
writer.write('`')

writer.write('\n\n')

// Insert userscript-exclusive files
const userscriptFiles = await readdir('src/userscript/')
for (const i in userscriptFiles) {
    const file = Bun.file('src/userscript/' + userscriptFiles[i])
    if (file.type == 'application/octet-stream') continue
    if (file.name == 'src/userscript/header.js') continue
    const content = await file.text()
    writer.write(content)
    if (i != userscriptFiles.length-1) writer.write('\n\n')
}

writer.write('\n\n')

// Insert mutual source files
const sourceFiles = await readdir('src/')
for (const i in sourceFiles) {
    const file = Bun.file('src/' + sourceFiles[i])
    if (file.type == 'application/octet-stream') continue
    if (file.name == 'src/variables.js') continue
    const content = await file.text()
    writer.write(content)
    if (i != sourceFiles.length-1) writer.write('\n\n')
}

writer.write('\n\n')

// Insert cors bypass
const file = Bun.file('src/cors-bypass/userscript.js')
const content = await file.text()
writer.write(content)

writer.end()
