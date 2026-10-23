'use strict';
// The developer's build (scripts/pack.mjs --dev, npm run dev:chrome / dev:edge /
// dev:firefox): its own name, icons and Firefox add-on id, so it never stands in for
// the store copy, and scripts/dev-run.mjs runs it in a browser profile of its own.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f));
const { stubUi } = require('./ui-stubs.js');
const devRun = () => import(pathToFileURL(path.join(ROOT, 'scripts', 'dev-run.mjs')).href);

test('dev icons: one for every size the manifest names, none of them the public or beta one', () => {
  const manifest = JSON.parse(read('manifest.json'));
  for (const file of Object.values(manifest.icons)) {
    const dev = read(`dev/${file}`);
    assert.equal(dev.subarray(1, 4).toString(), 'PNG', `dev/${file} is a PNG`);
    assert.ok(!dev.equals(read(file)), `dev/${file} differs from ${file}`);
    assert.ok(!dev.equals(read(`beta/${file}`)), `dev/${file} differs from beta/${file}`);
  }
});

// scripts/pack.mjs with these arguments in a scratch copy of the files it builds from.
function pack(...args) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-dev-'));
  for (const f of ['manifest.json', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  for (const d of ['_locales', 'icons', 'src', 'beta', 'dev'])
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  stubUi(dir);
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack.mjs'), ...args], {
    cwd: dir,
    env: { ...process.env, OH_SYNC: '', OH_SITE: '' },
    stdio: 'pipe',
  });
  return dir;
}

test('dev build: "Open Hangar (Dev)", its icons and its own Firefox add-on id', () => {
  const dir = pack('--dev');
  try {
    assert.deepEqual(fs.readdirSync(path.join(dir, 'dist')).sort(), ['dev', 'dev-firefox']);
    for (const t of ['dev', 'dev-firefox']) {
      const m = JSON.parse(fs.readFileSync(path.join(dir, 'dist', t, 'manifest.json'), 'utf8'));
      assert.equal(m.name, 'Open Hangar (Dev)', t);
      assert.equal(m.action.default_title, 'Open Hangar (Dev)', t);
      for (const file of Object.values(m.icons))
        assert.ok(
          fs.readFileSync(path.join(dir, 'dist', t, file)).equals(read(`dev/${file}`)),
          `${t}: ${file} is the dev icon`,
        );
      if (t === 'dev') assert.equal(m.browser_specific_settings, undefined);
      else {
        // Firefox keys storage by this id: the store copy's would share its hangar.
        const gecko = m.browser_specific_settings.gecko;
        assert.equal(gecko.id, 'open-hangar-dev@draco-foundry');
        assert.equal(gecko.update_url, undefined);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the store build keeps the public name and add-on id', () => {
  const dir = pack();
  try {
    const ff = JSON.parse(
      fs.readFileSync(path.join(dir, 'dist', 'firefox', 'manifest.json'), 'utf8'),
    );
    assert.equal(ff.name, '__MSG_extName__');
    assert.equal(ff.browser_specific_settings.gecko.id, 'open-hangar@draco-foundry');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--dev and --beta are refused together', () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack.mjs'), '--dev', '--beta'], {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    /--dev and --beta/,
  );
});

test('dev build syncs to staging unless --site says otherwise', () => {
  const site = (dir, t) => {
    const lib = fs.readFileSync(path.join(dir, 'dist', t, 'src', 'lib.js'), 'utf8');
    return lib.match(/const SITE_BUILT_IN = ("[^"]*");/)?.[1];
  };
  let dir = pack('--dev');
  try {
    for (const t of ['dev', 'dev-firefox'])
      assert.equal(site(dir, t), '"https://staging.openhangar.space"', t);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  dir = pack('--dev', '--site=https://app.openhangar.space');
  try {
    assert.equal(site(dir, 'dev'), '"https://app.openhangar.space"');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every browser runs the dev build in a profile of its own in this folder', async () => {
  const { runOptions, PROFILES } = await devRun();
  const root = path.join(os.tmpdir(), 'oh-repo');
  for (const browser of ['chrome', 'edge', 'firefox']) {
    const o = runOptions(browser, { root, env: {}, platform: 'win32' });
    const profile = o.firefoxProfile || o.chromiumProfile;
    assert.equal(profile, path.join(root, PROFILES, browser), browser);
    assert.equal(o.profileCreateIfMissing, true, browser);
    assert.equal(o.keepProfileChanges, true, browser);
    assert.equal(
      o.sourceDir,
      path.join(root, 'dist', browser === 'firefox' ? 'dev-firefox' : 'dev'),
      browser,
    );
  }
  assert.match(runOptions('edge', { root, env: {}, platform: 'darwin' }).chromiumBinary, /Edge/);
  assert.equal(
    runOptions('chrome', { root, env: { CHROME_PATH: '/x/chrome' } }).chromiumBinary,
    '/x/chrome',
  );
  assert.throws(() => runOptions('safari', { root }), /chrome, edge or firefox/);
  assert.match(read('.gitignore').toString(), /^\/\.dev-profiles\/$/m);
  const scripts = JSON.parse(read('package.json')).scripts;
  for (const browser of ['chrome', 'edge', 'firefox'])
    assert.equal(
      scripts[`dev:${browser}`],
      `npm run dev:build && node scripts/dev-run.mjs ${browser}`,
    );
});
