'use strict';
// Build flags (src/flags.js, scripts/build-flags.mjs, docs/FLAGS.md): the registry,
// each build's values, the @flag markers, and real builds by scripts/pack.mjs in a
// scratch copy of the repo. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const FLAGS_SRC = fs.readFileSync(path.join(ROOT, 'src', 'flags.js'), 'utf8');
const lib = () => import('../scripts/build-flags.mjs');

test('registry parses: every flag has a name, a one-line about and a default', async () => {
  const { loadFlags, validateRegistry } = await lib();
  const { registry, values } = loadFlags(FLAGS_SRC);
  validateRegistry(registry);
  assert.deepEqual(Object.keys(registry).sort(), ['orgFleet', 'sync']);
  for (const [name, f] of Object.entries(registry)) {
    assert.ok(f.about.length < 100, `${name}: keep about to one short line`);
    assert.ok(!/\u2014/.test(f.about), `${name}: no em dashes`);
    assert.equal(values[name], f.default, `${name}: the source holds the default`);
  }
  assert.ok(FLAGS_SRC.includes('const BUILD_VALUES = {};'), 'the source keeps BUILD_VALUES empty');
});

test('registry: bad entries fail loudly', async () => {
  const { validateRegistry } = await lib();
  const ok = { about: 'A flag.', default: false };
  assert.throws(() => validateRegistry({ 'Bad-Name': ok }), /camelCase/);
  assert.throws(() => validateRegistry({ x: { ...ok, about: 'two\nlines' } }), /one-line/);
  assert.throws(() => validateRegistry({ x: { about: 'A flag.' } }), /default/);
  assert.throws(() => validateRegistry({ x: { ...ok, remote: true } }), /unknown key/);
  assert.throws(() => validateRegistry({ x: { ...ok, devOnly: true, beta: true } }), /dev-only/);
  assert.throws(() => validateRegistry({ x: { ...ok, default: true, devOnly: true } }), /dev-only/);
});

test('public store builds get the defaults; the beta its set; sync is on in both', async () => {
  const { loadFlags, buildValues } = await lib();
  const { registry } = loadFlags(FLAGS_SRC);
  assert.deepEqual(buildValues(registry), { sync: true, orgFleet: false });
  assert.deepEqual(buildValues(registry, { beta: true }), { sync: true, orgFleet: false });
  assert.deepEqual(buildValues(registry, { overrides: { sync: false } }), {
    sync: false,
    orgFleet: false,
  });
  assert.equal(registry.orgFleet.devOnly, true, 'orgFleet stays out of every store build');
  assert.throws(() => buildValues(registry, { overrides: { nope: true } }), /no such flag/);
});

test('--flag name=on|off, repeatable; unknown names and values fail', async () => {
  const { loadFlags, parseFlagArgs } = await lib();
  const { registry } = loadFlags(FLAGS_SRC);
  assert.deepEqual(
    parseFlagArgs(['--sync', '--flag', 'orgFleet=on', '--flag=sync=off'], registry),
    { orgFleet: true, sync: false },
  );
  assert.throws(() => parseFlagArgs(['--flag', 'orgFleet'], registry), /name=on or name=off/);
  assert.throws(() => parseFlagArgs(['--flag', 'orgFleet=yes'], registry), /name=on/);
  assert.throws(() => parseFlagArgs(['--flag'], registry), /name=on/);
  assert.throws(() => parseFlagArgs(['--flag', 'teleport=on'], registry), /no such flag/);
});

test('writeFlags puts the values into a built copy, read back as OH.flags', async () => {
  const { writeFlags, loadFlags } = await lib();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-flags-'));
  const file = path.join(dir, 'flags.js');
  fs.writeFileSync(file, FLAGS_SRC);
  writeFlags(file, { sync: false, orgFleet: true });
  const { values } = loadFlags(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(values, { sync: false, orgFleet: true });
  assert.throws(() => writeFlags(file, {}), /expected one/, 'only ever written once');
  fs.rmSync(dir, { recursive: true, force: true });
});

const SAMPLE = [
  'a();',
  '// @flag-start orgFleet: sharing',
  'shareFleet();',
  '// @flag-end orgFleet',
  'b();',
  '<!-- @sync-start -->',
  '<div id="sync"></div>',
  '<!-- @sync-end -->',
  'c();',
].join('\n');

test('markers: off flags are cut, on flags stay as written', async () => {
  const { stripFlags } = await lib();
  assert.equal(stripFlags(SAMPLE, { sync: false, orgFleet: false }), 'a();\nb();\nc();');
  assert.equal(stripFlags(SAMPLE, { sync: true, orgFleet: true }), SAMPLE);
  assert.equal(
    stripFlags(SAMPLE, { sync: true, orgFleet: false }),
    'a();\nb();\n<!-- @sync-start -->\n<div id="sync"></div>\n<!-- @sync-end -->\nc();',
  );
});

test('markers: nested, unclosed, mismatched, unnamed and unknown blocks fail loudly', async () => {
  const { stripFlags } = await lib();
  const v = { sync: false, orgFleet: false };
  const run = (lines) => () => stripFlags(lines.join('\n'), v, 'x.js');
  assert.throws(
    run(['// @flag-start orgFleet', '// @sync-start', '// @sync-end', '// @flag-end orgFleet']),
    /x\.js:2: @sync-start inside the "orgFleet" block from line 1/,
  );
  assert.throws(
    run(['// @flag-start orgFleet', '// @flag-start orgFleet']),
    /inside the "orgFleet" block/,
  );
  assert.throws(run(['a();', '// @flag-start orgFleet', 'b();']), /x\.js:2: .* never closed/);
  assert.throws(run(['// @sync-end']), /without a start/);
  assert.throws(run(['// @flag-start orgFleet', '// @flag-end sync']), /closes the "orgFleet"/);
  assert.throws(run(['// @flag-start', '// @flag-end']), /needs a flag name/);
  assert.throws(run(['// @flag-start teleport', '// @flag-end teleport']), /names no flag/);
  // Nothing fails silently when the flag is on, either.
  assert.throws(
    () => stripFlags('// @flag-start orgFleet', { sync: true, orgFleet: true }, 'y.js'),
    /never closed/,
  );
});

// Every source file's markers are well formed, and every flag the code reads exists.
function sourceFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (path.relative(ROOT, p) !== path.join('src', 'ui')) sourceFiles(p, out); // generated
    } else if (/\.(js|html|css|svelte)$/.test(e.name)) out.push(p);
  }
  return out;
}
test("the code's markers and flag reads all name registered flags", async () => {
  const { loadFlags, stripFlags } = await lib();
  const { registry } = loadFlags(FLAGS_SRC);
  const off = Object.fromEntries(Object.keys(registry).map((f) => [f, false]));
  for (const file of [
    ...sourceFiles(path.join(ROOT, 'src')),
    ...sourceFiles(path.join(ROOT, 'ui')),
  ]) {
    if (file.endsWith(path.join('src', 'flags.js'))) continue;
    const text = fs.readFileSync(file, 'utf8');
    stripFlags(text, off, path.relative(ROOT, file)); // throws on a bad marker
    const reads = /\bOH\??\.flags\??\.([A-Za-z0-9_]+)|\bflag\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const [, a, b] of text.matchAll(reads))
      assert.ok((a || b) in registry, `${path.relative(ROOT, file)} reads flag "${a || b}"`);
  }
});

// A real scripts/pack.mjs run, in a scratch copy of the files it builds from.
function scratchRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-pack-'));
  for (const f of ['manifest.json', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  for (const d of ['_locales', 'icons', 'src', 'beta'])
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  // A probe the build should cut unless orgFleet is on.
  fs.writeFileSync(
    path.join(dir, 'src', 'probe.js'),
    'keep();\n// @flag-start orgFleet\norgFleetOnly();\n// @flag-end orgFleet\n',
  );
  return dir;
}
const pack = (dir, args = [], env = {}) =>
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack.mjs'), ...args], {
    cwd: dir,
    env: { ...process.env, OH_SYNC: '', OH_SITE: '', ...env },
    encoding: 'utf8',
    stdio: 'pipe',
  });
const check = (dir) =>
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'check-store-build.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
const SYNC_DATA = ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'];

test('pack: writes each build its values and cuts the code of flags that are off', async () => {
  const { loadFlags } = await lib();
  const dir = scratchRepo();
  const built = (target) => ({
    flags: loadFlags(fs.readFileSync(path.join(dir, 'dist', target, 'src', 'flags.js'), 'utf8'))
      .values,
    probe: fs.readFileSync(path.join(dir, 'dist', target, 'src', 'probe.js'), 'utf8'),
    lib: fs.readFileSync(path.join(dir, 'dist', target, 'src', 'lib.js'), 'utf8'),
    manifest: JSON.parse(fs.readFileSync(path.join(dir, 'dist', target, 'manifest.json'))),
  });
  try {
    // The public store build: every flag at its default (sync on), flagged code gone.
    pack(dir);
    for (const t of ['chrome', 'firefox']) {
      const b = built(t);
      assert.deepEqual(b.flags, { sync: true, orgFleet: false }, t);
      assert.equal(b.probe, 'keep();\n', `${t}: orgFleet code cut`);
      assert.match(b.lib, /OH\.siteLinkStart\s*=/, `${t}: sync code kept`);
      assert.match(
        b.lib,
        /const SITE_BUILT_IN = "https:\/\/app\.openhangar\.space";/,
        `${t}: built in to production`,
      );
      assert.ok(b.manifest.permissions.includes('identity'), `${t}: identity for Connect`);
      assert.ok(!/staging/.test(JSON.stringify(b.manifest)), `${t}: no staging`);
    }
    assert.deepEqual(built('chrome').manifest.externally_connectable.matches, [
      'https://openhangar.space/*',
      'https://app.openhangar.space/*',
    ]);
    const ff = built('firefox').manifest;
    assert.deepEqual(
      ff.background,
      { scripts: ['src/flags.js', 'src/rsi-cart.js', 'src/background.js'] },
      "Firefox's event page loads what background.js imports on Chrome, first",
    );
    assert.deepEqual(
      ff.content_scripts.map((c) => [c.js, c.matches]),
      [[['src/site-bridge.js'], ['https://openhangar.space/*', 'https://app.openhangar.space/*']]],
      "Firefox's one-click Connect: the site bridge on our own site",
    );
    assert.deepEqual(ff.browser_specific_settings.gecko.data_collection_permissions, {
      required: ['none'],
      optional: SYNC_DATA,
    });
    assert.match(check(dir), /clean store build \(sync built in to production/);
    // The source copy keeps its defaults.
    assert.equal(fs.readFileSync(path.join(dir, 'src', 'flags.js'), 'utf8'), FLAGS_SRC);

    // A developer's build with a dev-only flag on: built, and the store check refuses it.
    assert.match(pack(dir, ['--flag', 'orgFleet=on']), /dev build, never for a store/);
    assert.deepEqual(built('chrome').flags, { sync: true, orgFleet: true });
    assert.match(built('chrome').probe, /orgFleetOnly\(\);/);
    assert.throws(() => check(dir), /flag "orgFleet" is on, and it's dev-only/);

    // OH_SYNC=1, --sync and --flag sync=on are the store build now.
    for (const [args, env] of [[[], { OH_SYNC: '1' }], [['--sync']], [['--flag', 'sync=on']]]) {
      assert.doesNotMatch(pack(dir, args, env), /dev build/);
      assert.deepEqual(built('chrome').flags, { sync: true, orgFleet: false });
      assert.match(built('chrome').lib, /OH\.siteLinkStart\s*=/, 'sync code kept');
      assert.match(check(dir), /clean store build/);
    }

    // --flag sync=off: a developer's build with the sync code cut, which the store
    // check refuses. The identity permission stays (it's in manifest.json).
    assert.match(pack(dir, ['--flag', 'sync=off']), /dev build, never for a store/);
    for (const t of ['chrome', 'firefox']) {
      const b = built(t);
      assert.deepEqual(b.flags, { sync: false, orgFleet: false }, t);
      assert.ok(!/OH\.siteLinkStart\s*=/.test(b.lib), `${t}: sync code cut`);
      assert.ok(!/SITE_BUILT_IN/.test(b.lib), `${t}: no built-in site`);
      assert.ok(b.manifest.permissions.includes('identity'), `${t}: identity in every build`);
    }
    assert.deepEqual(
      built('firefox').manifest.browser_specific_settings.gecko.data_collection_permissions,
      {
        required: ['none'],
      },
    );
    assert.throws(() => check(dir), /flag "sync" is off, the store default is on/);
    assert.throws(
      () => pack(dir, ['--flag', 'sync=off', '--site=https://staging.openhangar.space']),
      /needs sync on/,
    );

    // A developer's staging build: built in to staging, which lets staging in too.
    const staging = pack(dir, ['--site=https://staging.openhangar.space']);
    assert.match(staging, /syncing to https:\/\/staging\.openhangar\.space.*dev build/);
    assert.match(built('chrome').lib, /SITE_BUILT_IN = "https:\/\/staging\.openhangar\.space"/);
    assert.ok(
      built('chrome').manifest.externally_connectable.matches.includes(
        'https://staging.openhangar.space/*',
      ),
    );
    assert.throws(() => check(dir), /the staging site/);

    // The beta: exactly the beta set, no overrides.
    pack(dir, ['--beta']);
    assert.deepEqual(built('beta').flags, { sync: true, orgFleet: false });
    assert.deepEqual(built('beta-firefox').flags, { sync: true, orgFleet: false });
    assert.throws(() => pack(dir, ['--beta', '--flag', 'orgFleet=on']), /beta set/);
    assert.throws(() => pack(dir, ['--flag', 'warpDrive=on']), /no such flag/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
