'use strict';
// Open Hangar Beta (docs/BETA.md, npm run build:beta): its version file and icons,
// and the Firefox beta's manifest from a real scripts/pack.mjs --beta run. The built
// packages are checked by scripts/check-store-build.mjs --beta. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f));

test('beta version: four numbers for the stores, "0.3.0 Beta N" for people', () => {
  const b = JSON.parse(read('beta/beta.json'));
  const parts = b.version.split('.');
  assert.equal(parts.length, 4, 'Chrome and Edge take up to four dotted numbers');
  for (const p of parts) assert.ok(/^\d+$/.test(p) && +p <= 65535, `"${p}" in ${b.version}`);
  const m = /^(\d+\.\d+\.\d+) Beta (\d+)$/.exec(b.version_name);
  assert.ok(m, `version_name "${b.version_name}"`);
  assert.equal(`${m[1]}.${m[2]}`, b.version, 'Beta N is the fourth number');
});

test('beta icons: one for every size the manifest names, none of them the public one', () => {
  const manifest = JSON.parse(read('manifest.json'));
  for (const file of Object.values(manifest.icons)) {
    const beta = read(`beta/${file}`);
    assert.equal(beta.subarray(1, 4).toString(), 'PNG', `beta/${file} is a PNG`);
    assert.ok(!beta.equals(read(file)), `beta/${file} differs from ${file}`);
  }
});

// scripts/pack.mjs --beta in a scratch copy of the files it builds from.
function betaBuild() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-beta-'));
  for (const f of ['manifest.json', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  for (const d of ['_locales', 'icons', 'src', 'beta'])
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack.mjs'), '--beta'], {
    cwd: dir,
    env: { ...process.env, OH_SYNC: '', OH_SITE: '' },
    stdio: 'pipe',
  });
  return dir;
}
const manifestOf = (dir, build) =>
  JSON.parse(fs.readFileSync(path.join(dir, 'dist', build, 'manifest.json'), 'utf8'));
// The store check's complaints (the scratch build has no zips, so it always fails).
function storeCheck(dir) {
  try {
    execFileSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'check-store-build.mjs'), '--beta'],
      { cwd: dir, encoding: 'utf8', stdio: 'pipe' },
    );
    return '';
  } catch (e) {
    return e.stderr;
  }
}

test('Firefox beta: its own add-on id, update_url, the beta version and sync data', () => {
  const dir = betaBuild();
  try {
    const b = JSON.parse(read('beta/beta.json'));
    const ff = manifestOf(dir, 'beta-firefox');
    const gecko = ff.browser_specific_settings.gecko;
    assert.equal(ff.name, 'Open Hangar Beta');
    assert.equal(ff.version, b.version, 'version from beta/beta.json');
    assert.equal(gecko.id, 'open-hangar-beta@draco-foundry', 'never the public add-on id');
    assert.equal(gecko.update_url, 'https://app.openhangar.space/beta/firefox-updates.json');
    assert.deepEqual(gecko.data_collection_permissions, {
      required: ['none'],
      optional: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
    });
    assert.ok(ff.permissions.includes('identity'), 'Connect');
    assert.deepEqual(ff.background, {
      scripts: ['src/flags.js', 'src/rsi-cart.js', 'src/background.js'],
    });
    assert.ok(fs.existsSync(path.join(dir, 'dist/beta-firefox/src/site-bridge.js')));
    // The Chrome and Edge beta next to it stays as it was.
    const chrome = manifestOf(dir, 'beta');
    assert.equal(chrome.browser_specific_settings, undefined);
    assert.equal(chrome.version, b.version);
    // Both pass the store check, apart from the zips only npm run build:beta makes.
    assert.deepEqual(
      storeCheck(dir)
        .split('\n')
        .filter((l) => /^ {2}\S/.test(l)),
      [
        '  dist: no open-hangar-beta-<version>.zip',
        '  dist: no open-hangar-beta-firefox-<version>.zip',
      ],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store check: refuses a Firefox beta with the public id, no update_url or staging', () => {
  const dir = betaBuild();
  try {
    const file = path.join(dir, 'dist/beta-firefox/manifest.json');
    const ff = manifestOf(dir, 'beta-firefox');
    ff.browser_specific_settings.gecko.id = 'open-hangar@draco-foundry';
    delete ff.browser_specific_settings.gecko.update_url;
    delete ff.browser_specific_settings.gecko.data_collection_permissions;
    ff.content_scripts[0].matches.push('https://staging.openhangar.space/*');
    fs.writeFileSync(file, JSON.stringify(ff));
    const out = storeCheck(dir);
    assert.match(out, /add-on id "open-hangar@draco-foundry", not the beta's/);
    assert.match(out, /update_url "undefined"/);
    assert.match(out, /no data_collection_permissions/);
    assert.match(out, /beta-firefox\/manifest\.json: the staging site/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
