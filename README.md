# What is this
This is a prototype branch which focuses on restructuring the code. Not for normal use.

# Build extension
You need to have Bun.js installed. Clone this branch, navigate to the root directory and execute `bun build-all` in terminal. Files should appear in `dist` directory.

# Disclaimers
1. Only userscript works
1. Extension and userscript needs a rewrite, specifically `manifest.json`
1. Some variables from manifest.json and userscript header should share same declarations somewhere
1. We don't need many @connect declarations in userscript header, I think.