'use strict';
// The connector build (scripts/connector.mjs, scripts/pack.mjs,
// scripts/check-store-build.mjs): only the popup, the basic page and what they load,
// requests limited to RSI, openhangar.space and the sync site, and a store check that
// knows the difference. Real builds in a scratch copy of the repo. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
// Stand-ins for the built Svelte pages (src/ui is generated, and npm test runs before
// the build in CI), shaped like Vite's output: entries importing a shared chunk.
const UI_STUBS = {
  'popup.js': 'import { a } from "./shared.js";\nimport { w } from "./when.js";\n',
  'basic.js': 'import { a } from "./shared.js";\n',
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

function scratch({ connectorDefault = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-connector-'));
  for (const f of ['manifest.json', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  // The scripts too: the store check reads the flag defaults beside itself.
  for (const d of ['_locales', 'icons', 'src', 'beta', 'scripts'])
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  const ui = path.join(dir, 'src', 'ui');
  fs.rmSync(ui, { recursive: true, force: true });
  for (const [f, text] of Object.entries(UI_STUBS)) {
    fs.mkdirSync(path.dirname(path.join(ui, f)), { recursive: true });
    fs.writeFileSync(path.join(ui, f), text);
  }
  if (connectorDefault) {
    // The day the connector ships: on in the store build, with Local Mode.
    const f = path.join(dir, 'src', 'flags.js');
    const text = fs
      .readFileSync(f, 'utf8')
      .replace(/(localMode: \{[^}]*?default: )false/, '$1true')
      .replace(/(connector: \{[^}]*?default: )false/, '$1true');
    fs.writeFileSync(f, text);
  }
  return dir;
}
const run = (dir, script, args = []) =>
  execFileSync(process.execPath, [path.join(dir, 'scripts', script), ...args], {
    cwd: dir,
    env: { ...process.env, OH_SYNC: '', OH_SITE: '' },
    encoding: 'utf8',
    stdio: 'pipe',
  });
const problems = (dir) => {
  try {
    run(dir, 'check-store-build.mjs');
    return [];
  } catch (e) {
    return e.stderr
      .split('\n')
      .filter((l) => /^ {2}\S/.test(l))
      .map((l) => l.trim());
  }
};
const filesOf = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out;
};

test('connector build: the popup, the basic page and what they load, nothing else', () => {
  const dir = scratch({ connectorDefault: true });
  try {
    run(dir, 'pack.mjs');
    for (const t of ['chrome', 'firefox']) {
      const out = path.join(dir, 'dist', t);
      const files = filesOf(out);
      const src = files.filter((f) => f.startsWith('src/') && !f.startsWith('src/ui/fonts/'));
      for (const f of ['src/popup.html', 'src/basic.html', 'src/ui/popup.js', 'src/ui/basic.js'])
        assert.ok(files.includes(f), `${t}: ${f}`);
      for (const f of ['src/dashboard.html', 'src/dashboard.js', 'src/quips.js', 'CHANGELOG.md'])
        assert.ok(!files.includes(f), `${t}: no ${f}`);
      assert.ok(!files.some((f) => f.startsWith('src/assets/')), `${t}: no dashboard pictures`);
      assert.deepEqual(
        files.filter((f) => f.startsWith('src/ui/')).sort(),
        ['basic.css', 'basic.js', 'fonts/m.woff2', 'popup.css', 'popup.js']
          .concat(['shared.js', 'tokens.css', 'when.js'])
          .map((f) => `src/ui/${f}`),
        `${t}: only what the two pages load`,
      );
      // Every script the two pages load is there.
      for (const page of ['src/popup.html', 'src/basic.html']) {
        const html = fs.readFileSync(path.join(out, page), 'utf8');
        for (const [, ref] of html.matchAll(/\b(?:src|href)="([^"]+)"/g))
          assert.ok(files.includes(path.posix.join('src', ref)), `${t}: ${page} loads ${ref}`);
      }
      assert.ok(src.length < 30, `${t}: a small build (${src.length} files)`);
      const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
      assert.equal(m.action.default_popup, 'src/popup.html');
      assert.match(
        m.content_security_policy.extension_pages,
        /; connect-src 'self' https:\/\/robertsspaceindustries\.com https:\/\/openhangar\.space https:\/\/app\.openhangar\.space$/,
      );
      // The permissions stay as they are (docs/FLAGS.md, The Connector).
      assert.deepEqual(m.permissions, ['storage', 'unlimitedStorage', 'cookies', 'identity']);
      assert.deepEqual(m.host_permissions, ['https://robertsspaceindustries.com/*']);
    }
    assert.match(run(dir, 'check-store-build.mjs'), /clean store build/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store check: a connector build that let the dashboard back in is refused', () => {
  const dir = scratch({ connectorDefault: true });
  try {
    run(dir, 'pack.mjs');
    const out = path.join(dir, 'dist', 'chrome');
    fs.copyFileSync(
      path.join(ROOT, 'src', 'dashboard.html'),
      path.join(out, 'src', 'dashboard.html'),
    );
    fs.writeFileSync(path.join(out, 'src', 'ui', 'home.js'), UI_STUBS['home.js']);
    const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    m.content_security_policy.extension_pages = m.content_security_policy.extension_pages.replace(
      / connect-src[^;]*$/,
      '',
    );
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m));
    fs.rmSync(path.join(dir, 'dist', 'firefox', 'src', 'ui', 'basic.js'));
    assert.deepEqual(problems(dir).sort(), [
      "chrome: its pages may send requests beyond connect-src 'self' https://robertsspaceindustries.com https://openhangar.space https://app.openhangar.space",
      'chrome: src/dashboard.html is in a connector build',
      "chrome: src/ui/home.js isn't the connector's",
      "firefox: src/basic.html loads ui/basic.js, which isn't in the build",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store check: no popup or basic page without the connector', () => {
  const dir = scratch();
  try {
    run(dir, 'pack.mjs');
    assert.deepEqual(problems(dir), []);
    const out = path.join(dir, 'dist', 'chrome');
    assert.ok(fs.existsSync(path.join(out, 'src', 'dashboard.html')));
    fs.copyFileSync(path.join(ROOT, 'src', 'popup.html'), path.join(out, 'src', 'popup.html'));
    const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    m.action.default_popup = 'src/popup.html';
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m));
    assert.deepEqual(problems(dir).sort(), [
      'chrome: a toolbar popup without the connector',
      'chrome: src/popup.html without the connector',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the connector keeps only what its pages import', async () => {
  const { connectorUi } = await import('../scripts/connector.mjs');
  const files = {
    'basic.js': 'import { a } from "./shared.js";\n// import x from "./home.js"\n',
    'popup.js': 'import { b } from "./shared.js";\nimport { c } from "./when.js";\n',
    'shared.js': "/** @import { X } from './types.js' */\nexport const a = 1;\n",
    'when.js': 'export const c = 3;\n',
    'home.js': 'import { a } from "./shared.js";\n',
    'tokens.css': '@font-face{src:url(./fonts/m.woff2) format("woff2"),url("./fonts/m.woff")}',
    'basic.css': '.x{}',
  };
  const keep = connectorUi((f) => files[f] ?? null);
  assert.deepEqual([...keep].sort(), [
    'basic.css',
    'basic.js',
    'fonts/m.woff',
    'fonts/m.woff2',
    'popup.js',
    'shared.js',
    'tokens.css',
    'when.js',
  ]);
});
