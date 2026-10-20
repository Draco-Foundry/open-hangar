'use strict';
// Stand-ins for the built Svelte pages in a scratch copy of the repo. src/ui is generated
// (npm run build:ui), and npm test runs before that build in CI, but every store build
// now has the connector, whose popup, basic page and hidden scan page load src/ui files
// the store check looks for. Shaped like Vite's output: entries importing a shared chunk. Used by
// test/connector-build.test.js, test/build-flags.test.js and test/beta-build.test.js.
const fs = require('node:fs');
const path = require('node:path');

const UI_STUBS = {
  'popup.js': 'import { a } from "./shared.js";\nimport { w } from "./when.js";\n',
  'basic.js': 'import { a } from "./shared.js";\nimport { r } from "./runner.js";\n',
  // The hidden scan page: the scan runner, shared with the basic page, and no Svelte.
  'scan.js': 'import { r } from "./runner.js";\n',
  'runner.js': 'export const r = 3;\n',
  'home.js': 'import { a } from "./shared.js";\nimport { w } from "./when.js";\n',
  'store.js': 'import { a } from "./shared.js";\n',
  'shared.js': "/** @import { X } from './types.js' */\nexport const a = 1;\n",
  'when.js': 'export const w = 2;\n',
  'popup.css': '.pp{}',
  'basic.css': '.bp{}',
  'tokens.css': '@font-face{src:url(./fonts/m.woff2)}',
  'home.css': '@font-face{src:url(./fonts/m.woff2)}',
  'store.css': '.s{}',
  'fonts/m.woff2': 'font',
};

// Replaces <dir>/src/ui (a real build of it, if one was copied in) with the stand-ins.
function stubUi(dir) {
  const ui = path.join(dir, 'src', 'ui');
  fs.rmSync(ui, { recursive: true, force: true });
  for (const [f, text] of Object.entries(UI_STUBS)) {
    fs.mkdirSync(path.dirname(path.join(ui, f)), { recursive: true });
    fs.writeFileSync(path.join(ui, f), text);
  }
}

module.exports = { UI_STUBS, stubUi };
