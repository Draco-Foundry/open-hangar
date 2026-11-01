'use strict';
// The connector build (scripts/connector.mjs, scripts/pack.mjs,
// scripts/check-store-build.mjs): only the popup, the basic page, the hidden scan page
// (scripts/scan-host.mjs) and what they load, requests limited to RSI, openhangar.space
// and the sync site, and a store check that knows the difference. Real builds in a
// scratch copy of the repo. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const { UI_STUBS, stubUi } = require('./ui-stubs.js');

// A scratch copy of the repo with the Svelte pages stood in for. Its registry's store
// build has the connector with Local Mode (as every store build since 0.3.0) and the
// wishlist import, and Extension Alerts (with the Daily Scan Reminder, which needs their alarms)
// only with `alerts: true` (the store builds have both too). With `connector: false`, a
// registry whose store build has no connector and no wishlist import (Local Mode stays
// on, as the beta had it before).
function scratch({ connector = true, alerts = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-connector-'));
  for (const f of ['manifest.json', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  // The scripts too: the store check reads the flag defaults beside itself.
  for (const d of ['_locales', 'icons', 'src', 'beta', 'scripts'])
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  stubUi(dir);
  const flagsFile = path.join(dir, 'src', 'flags.js');
  const setDefault = (name, on) => {
    const re = new RegExp(`(${name}: \\{[^}]*?default: )(true|false)`);
    const text = fs.readFileSync(flagsFile, 'utf8');
    assert.match(text, re, `src/flags.js has ${name}'s default`);
    fs.writeFileSync(flagsFile, text.replace(re, `$1${on}`));
  };
  setDefault('connector', connector);
  setDefault('wishlistImport', connector);
  setDefault('alerts', alerts);
  setDefault('autoScan', alerts);
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

const PAGES = ['src/popup.html', 'src/basic.html', 'src/scan.html'];
test('connector build: the popup, the basic page, the scan page and what they load, nothing else', () => {
  const dir = scratch();
  try {
    run(dir, 'pack.mjs');
    for (const t of ['chrome', 'firefox']) {
      const out = path.join(dir, 'dist', t);
      const files = filesOf(out);
      const src = files.filter((f) => f.startsWith('src/') && !f.startsWith('src/ui/fonts/'));
      for (const f of [
        ...PAGES,
        'src/ui/popup.js',
        'src/ui/basic.js',
        'src/ui/scan.js',
        'src/scan-host.js',
        'src/scan-shim.js',
      ])
        assert.ok(files.includes(f), `${t}: ${f}`);
      for (const f of ['src/dashboard.html', 'src/dashboard.js', 'src/quips.js', 'CHANGELOG.md'])
        assert.ok(!files.includes(f), `${t}: no ${f}`);
      assert.ok(!files.some((f) => f.startsWith('src/assets/')), `${t}: no dashboard pictures`);
      assert.deepEqual(
        files.filter((f) => f.startsWith('src/ui/')).sort(),
        ['basic.css', 'basic.js', 'fonts/m.woff2', 'popup.css', 'popup.js', 'runner.js']
          .concat(['scan.js', 'shared.js', 'tokens.css', 'when.js'])
          .map((f) => `src/ui/${f}`),
        `${t}: only what the three pages load`,
      );
      // Every script the three pages load is there.
      for (const page of PAGES) {
        const html = fs.readFileSync(path.join(out, page), 'utf8');
        for (const [, ref] of html.matchAll(/\b(?:src|href)="([^"]+)"/g))
          assert.ok(files.includes(path.posix.join('src', ref)), `${t}: ${page} loads ${ref}`);
      }
      assert.ok(src.length <= 32, `${t}: a small build (${src.length} files)`);
      const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
      assert.equal(m.action.default_popup, 'src/popup.html');
      // Alt+Shift+O opens the popup in every browser (manifest.json commands).
      assert.deepEqual(m.commands, {
        _execute_action: { suggested_key: { default: 'Alt+Shift+O', mac: 'Alt+Shift+O' } },
      });
      assert.match(
        m.content_security_policy.extension_pages,
        /; connect-src 'self' https:\/\/robertsspaceindustries\.com https:\/\/openhangar\.space https:\/\/app\.openhangar\.space$/,
      );
      // The permissions stay as they are (docs/FLAGS.md, The Connector), with Chrome and
      // Edge's offscreen for the hidden scan page (scripts/scan-host.mjs). Firefox holds
      // that page in a frame of its own event page instead: only its pages may frame
      // the extension's own.
      const BASE = ['storage', 'unlimitedStorage', 'cookies', 'identity'];
      assert.deepEqual(m.permissions, t === 'chrome' ? [...BASE, 'offscreen'] : BASE);
      assert.deepEqual(m.host_permissions, ['https://robertsspaceindustries.com/*']);
      assert.match(
        m.content_security_policy.extension_pages,
        t === 'chrome' ? /; frame-src 'none';/ : /; frame-src 'self';/,
      );
      const scripts = m.background.scripts || [];
      if (t === 'firefox') assert.ok(scripts.includes('src/scan-host.js'), 'Firefox loads it');
      const bg = fs.readFileSync(path.join(out, 'src', 'background.js'), 'utf8');
      assert.match(bg, /importScripts\('scan-host\.js'\)/);
    }
    assert.match(run(dir, 'check-store-build.mjs'), /clean store build/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store check: a connector build that let the dashboard back in is refused', () => {
  const dir = scratch();
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
    delete m.commands;
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m));
    fs.rmSync(path.join(dir, 'dist', 'firefox', 'src', 'ui', 'basic.js'));
    assert.deepEqual(problems(dir).sort(), [
      "chrome: its pages may send requests beyond connect-src 'self' https://robertsspaceindustries.com https://openhangar.space https://app.openhangar.space",
      'chrome: no keyboard shortcut opens the popup (commands._execute_action)',
      'chrome: src/dashboard.html is in a connector build',
      "chrome: src/ui/home.js isn't the connector's",
      "firefox: src/basic.html loads ui/basic.js, which isn't in the build",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store check: no popup or basic page without the connector', () => {
  // A registry whose store build has no connector (every store build had none before
  // 0.3.0): the dashboard, and the store check refuses the popup in it.
  const dir = scratch({ connector: false });
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

// --- Extension Alerts (scripts/alerts.mjs) ----------------------------------------------

const manifestOf = (dir, t) =>
  JSON.parse(fs.readFileSync(path.join(dir, 'dist', t, 'manifest.json'), 'utf8'));
const writeManifest = (dir, t, m) =>
  fs.writeFileSync(path.join(dir, 'dist', t, 'manifest.json'), JSON.stringify(m));

test('alerts build: src/alerts.js, alarms, notifications only optional, production built in', () => {
  const dir = scratch({ alerts: true });
  try {
    run(dir, 'pack.mjs');
    for (const t of ['chrome', 'firefox']) {
      const m = manifestOf(dir, t);
      assert.deepEqual(m.permissions, [
        'storage',
        'unlimitedStorage',
        'cookies',
        'identity',
        'alarms',
        ...(t === 'chrome' ? ['offscreen'] : []),
      ]);
      assert.deepEqual(m.optional_permissions, ['notifications']);
      const alerts = fs.readFileSync(path.join(dir, 'dist', t, 'src', 'alerts.js'), 'utf8');
      assert.match(alerts, /const SITE_BUILT_IN = "https:\/\/app\.openhangar\.space";/);
      const bg = fs.readFileSync(path.join(dir, 'dist', t, 'src', 'background.js'), 'utf8');
      assert.match(bg, /importScripts\('alerts\.js'\)/);
    }
    assert.ok(manifestOf(dir, 'firefox').background.scripts.includes('src/alerts.js'));
    assert.match(run(dir, 'check-store-build.mjs'), /clean store build/);
    // Tampered: notifications required, alarms gone, Firefox not loading the file.
    const m = manifestOf(dir, 'chrome');
    m.permissions = [
      'storage',
      'unlimitedStorage',
      'cookies',
      'identity',
      'notifications',
      'offscreen',
    ];
    writeManifest(dir, 'chrome', m);
    const ff = manifestOf(dir, 'firefox');
    ff.background.scripts = ff.background.scripts.filter((f) => f !== 'src/alerts.js');
    writeManifest(dir, 'firefox', ff);
    assert.deepEqual(problems(dir).sort(), [
      "chrome: no alarms permission (the alerts' checks)",
      "chrome: notifications is required (it's asked for, optional)",
      "firefox: Firefox's event page doesn't load src/alerts.js",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no alerts: no src/alerts.js, no alarms, no notifications', () => {
  const dir = scratch();
  try {
    run(dir, 'pack.mjs');
    for (const t of ['chrome', 'firefox']) {
      assert.ok(!fs.existsSync(path.join(dir, 'dist', t, 'src', 'alerts.js')), t);
      assert.equal(manifestOf(dir, t).optional_permissions, undefined, t);
      const bg = fs.readFileSync(path.join(dir, 'dist', t, 'src', 'background.js'), 'utf8');
      assert.ok(!/OHAlerts|chrome\.alarms/.test(bg), `${t}: the alerts' code cut`);
    }
    assert.ok(!manifestOf(dir, 'firefox').background.scripts.includes('src/alerts.js'));
    const m = manifestOf(dir, 'chrome');
    m.permissions.push('alarms');
    m.optional_permissions = ['notifications'];
    writeManifest(dir, 'chrome', m);
    fs.copyFileSync(
      path.join(ROOT, 'src', 'alerts.js'),
      path.join(dir, 'dist', 'firefox', 'src', 'alerts.js'),
    );
    assert.deepEqual(problems(dir).sort(), [
      'chrome: the alarms permission without alerts',
      'chrome: the notifications permission without alerts',
      // The repo's copy, with no site built in.
      'dist/firefox/src/alerts.js: built in to "", not production',
      'firefox: src/alerts.js without alerts',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('alerts need the connector', () => {
  const dir = scratch();
  try {
    assert.throws(
      () => run(dir, 'pack.mjs', ['--flag', 'connector=off', '--flag', 'alerts=on']),
      /alerts=on needs the connector/,
    );
    // On top of the store build, which has the connector: a developer's build.
    assert.match(
      run(dir, 'pack.mjs', ['--flag', 'alerts=on']),
      /flags on: sync, localMode, connector, wishlistImport, alerts, scanBar, accountLogs \(dev build, never for a store\)/,
    );
    // The Daily Scan Reminder's alarm is the alerts' alarms permission: not without them.
    assert.throws(
      () => run(dir, 'pack.mjs', ['--flag', 'autoScan=on']),
      /autoScan=on needs alerts on \(it uses their alarms permission\)/,
    );
    assert.match(
      run(dir, 'pack.mjs', ['--flag', 'alerts=on', '--flag', 'autoScan=on']),
      /flags on: sync, localMode, connector, wishlistImport, alerts, autoScan, scanBar, accountLogs \(dev build, never for a store\)/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- The hidden scan page (scripts/scan-host.mjs) ---------------------------------------------

test('store check: a connector build without what the hidden scan page needs is refused', () => {
  const dir = scratch();
  try {
    run(dir, 'pack.mjs');
    const read = (t) => manifestOf(dir, t);
    const write = (t, m) => writeManifest(dir, t, m);
    const csp = (m, from, to) => {
      const pages = m.content_security_policy.extension_pages;
      assert.ok(pages.includes(from), `${from} in ${pages}`);
      m.content_security_policy.extension_pages = pages.replace(from, to);
    };
    // Chrome: offscreen gone, its pages let frames in.
    const c = read('chrome');
    c.permissions = c.permissions.filter((p) => p !== 'offscreen');
    csp(c, "frame-src 'none'", "frame-src 'self'");
    write('chrome', c);
    // Firefox: offscreen asked for, frames shut out, the worker script not loaded, the
    // shim gone.
    const f = read('firefox');
    f.permissions.push('offscreen');
    csp(f, "frame-src 'self'", "frame-src 'none'");
    f.background.scripts = f.background.scripts.filter((s) => s !== 'src/scan-host.js');
    write('firefox', f);
    fs.rmSync(path.join(dir, 'dist', 'firefox', 'src', 'scan-shim.js'));
    assert.deepEqual(problems(dir).sort(), [
      'chrome: its pages may hold frames',
      'chrome: no offscreen permission (the hidden scan page)',
      "firefox: Firefox's event page doesn't load src/scan-host.js",
      "firefox: Firefox's pages need frame-src 'self' for the hidden scan page",
      'firefox: src/scan-shim.js is missing',
      "firefox: src/scan.html loads scan-shim.js, which isn't in the build",
      'firefox: the offscreen permission on Firefox',
    ]);
    // Offscreen only ever required: never optional.
    const o = read('chrome');
    o.optional_permissions = ['offscreen'];
    write('chrome', o);
    assert.ok(problems(dir).includes('chrome: offscreen is optional (scans need it)'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store check: no hidden scan page without the connector', () => {
  const dir = scratch({ connector: false });
  try {
    run(dir, 'pack.mjs');
    assert.deepEqual(problems(dir), []);
    for (const t of ['chrome', 'firefox']) {
      const m = manifestOf(dir, t);
      assert.ok(!m.permissions.includes('offscreen'), `${t}: no offscreen`);
      assert.match(m.content_security_policy.extension_pages, /; frame-src 'none';/);
      for (const f of ['src/scan.html', 'src/scan-host.js', 'src/scan-shim.js'])
        assert.ok(!fs.existsSync(path.join(dir, 'dist', t, f)), `${t}: no ${f}`);
    }
    const out = path.join(dir, 'dist', 'chrome');
    fs.copyFileSync(path.join(ROOT, 'src', 'scan-host.js'), path.join(out, 'src', 'scan-host.js'));
    const m = manifestOf(dir, 'chrome');
    m.permissions.push('offscreen');
    writeManifest(dir, 'chrome', m);
    const f = manifestOf(dir, 'firefox');
    f.content_security_policy.extension_pages = f.content_security_policy.extension_pages.replace(
      "frame-src 'none'",
      "frame-src 'self'",
    );
    writeManifest(dir, 'firefox', f);
    assert.deepEqual(problems(dir).sort(), [
      'chrome: src/scan-host.js without the connector',
      'chrome: the offscreen permission without the connector',
      'firefox: its pages may hold frames',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
