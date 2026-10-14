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
const { stubUi } = require('./ui-stubs.js');
const FLAGS_SRC = fs.readFileSync(path.join(ROOT, 'src', 'flags.js'), 'utf8');
const lib = () => import('../scripts/build-flags.mjs');

test('registry parses: every flag has a name, a one-line about and a default', async () => {
  const { loadFlags, validateRegistry } = await lib();
  const { registry, values } = loadFlags(FLAGS_SRC);
  validateRegistry(registry);
  assert.deepEqual(Object.keys(registry).sort(), [
    'alerts',
    'connector',
    'localMode',
    'orgFleet',
    'sync',
    'wishlistImport',
  ]);
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
  // From 0.3.0 every store build is the connector, with Local Mode, the wishlist import
  // and Extension Alerts (the privacy policy names each, test/privacy-permissions.test.js).
  const STORE = {
    sync: true,
    orgFleet: false,
    localMode: true,
    connector: true,
    wishlistImport: true,
    alerts: true,
  };
  assert.deepEqual(buildValues(registry), STORE);
  // The beta is the same set: no flag has a beta value of its own today.
  assert.deepEqual(buildValues(registry, { beta: true }), STORE);
  assert.deepEqual(buildValues(registry, { overrides: { sync: false } }), {
    ...STORE,
    sync: false,
  });
  assert.equal(registry.orgFleet.devOnly, true, 'orgFleet stays out of every store build');
  assert.ok(!registry.localMode.devOnly, 'Local Mode ships');
  assert.ok(!registry.connector.devOnly, 'the connector ships');
  assert.ok(!registry.alerts.devOnly, 'store alerts ship');
  assert.ok(!registry.wishlistImport.devOnly, 'the wishlist import ships');
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
  writeFlags(file, {
    sync: false,
    orgFleet: true,
    localMode: true,
    connector: false,
    wishlistImport: false,
    alerts: false,
  });
  const { values } = loadFlags(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(values, {
    sync: false,
    orgFleet: true,
    localMode: true,
    connector: false,
    wishlistImport: false,
    alerts: false,
  });
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
  // The connector's pages load the built Svelte pages (test/ui-stubs.js).
  stubUi(dir);
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
// The store check's complaints, one per line ([] when it passes).
function problemsOf(dir) {
  try {
    check(dir);
    return [];
  } catch (e) {
    return e.stderr
      .split('\n')
      .filter((l) => /^ {2}\S/.test(l))
      .map((l) => l.trim());
  }
}

test('pack: writes each build its values and cuts the code of flags that are off', async () => {
  const { loadFlags } = await lib();
  const dir = scratchRepo();
  const read = (target, f) => fs.readFileSync(path.join(dir, 'dist', target, f), 'utf8');
  const { readPages } = await import('../scripts/site-pages.mjs');
  const built = (target) => ({
    flags: loadFlags(fs.readFileSync(path.join(dir, 'dist', target, 'src', 'flags.js'), 'utf8'))
      .values,
    probe: fs.readFileSync(path.join(dir, 'dist', target, 'src', 'probe.js'), 'utf8'),
    lib: fs.readFileSync(path.join(dir, 'dist', target, 'src', 'lib.js'), 'utf8'),
    manifest: JSON.parse(fs.readFileSync(path.join(dir, 'dist', target, 'manifest.json'))),
    pages: readPages(
      fs.readFileSync(path.join(dir, 'dist', target, 'src', 'site-pages.js'), 'utf8'),
    ),
  });
  // Every store build's set (src/flags.js): the connector with Local Mode and sync, the
  // wishlist import and Extension Alerts.
  const STORE = {
    sync: true,
    orgFleet: false,
    localMode: true,
    connector: true,
    wishlistImport: true,
    alerts: true,
  };
  // Without the connector, what needs it goes too.
  const NO_CONNECTOR = [
    '--flag',
    'connector=off',
    '--flag',
    'alerts=off',
    '--flag',
    'wishlistImport=off',
  ];
  const ALL_PAGES = [
    'https://hangar.openhangar.space/*',
    'https://openhangar.space/*',
    'https://app.openhangar.space/*',
  ];
  try {
    // The public store build: every flag at its default, flagged code gone.
    pack(dir);
    for (const t of ['chrome', 'firefox']) {
      const b = built(t);
      assert.deepEqual(b.flags, STORE, t);
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
    assert.deepEqual(built('chrome').manifest.externally_connectable, { matches: ALL_PAGES });
    // The background worker's lists: the same pages, Connect on the app, and our hangar
    // page (Local Mode).
    assert.deepEqual(built('chrome').pages, {
      hangar: ['https://hangar.openhangar.space'],
      site: ['https://openhangar.space', 'https://app.openhangar.space'],
      connect: ['https://app.openhangar.space'],
    });
    // Local Mode's requests and the popup's Scan are kept.
    for (const t of ['chrome', 'firefox']) {
      const bg = read(t, 'src/background.js');
      for (const kept of [/oh-get-hangar/, /scanRequest/, /ohPopup/]) assert.match(bg, kept, t);
    }
    // The connector: the toolbar opens the popup, the basic page is the one page, and
    // the dashboard is left out (scripts/connector.mjs).
    for (const t of ['chrome', 'firefox']) {
      assert.equal(built(t).manifest.action.default_popup, 'src/popup.html', t);
      for (const f of ['src/popup.html', 'src/basic.html'])
        assert.ok(fs.existsSync(path.join(dir, 'dist', t, f)), `${t}: ${f}`);
      for (const f of ['src/dashboard.html', 'src/dashboard.js', 'CHANGELOG.md'])
        assert.ok(!fs.existsSync(path.join(dir, 'dist', t, f)), `${t}: no ${f}`);
    }
    const ff = built('firefox').manifest;
    assert.deepEqual(
      ff.background,
      {
        scripts: [
          'src/flags.js',
          'src/site-pages.js',
          'src/schema-check.js',
          'src/parser-rules-data.js',
          'src/parser-rules.js',
          'src/rsi-cart.js',
          'src/sync-schema.js',
          'src/hangar-shape.js',
          'src/scan-host.js',
          'src/alerts.js',
          'src/background.js',
        ],
      },
      "Firefox's event page loads what background.js imports on Chrome, first",
    );
    // Store alerts: the alarms permission, and Notifications only when the pilot turns
    // them on (scripts/alerts.mjs).
    for (const t of ['chrome', 'firefox']) {
      assert.ok(built(t).manifest.permissions.includes('alarms'), `${t}: alarms`);
      assert.deepEqual(built(t).manifest.optional_permissions, ['notifications'], t);
    }
    // The hidden scan page (scripts/scan-host.mjs): Chrome and Edge's offscreen document,
    // Firefox's frame in its event page.
    assert.ok(built('chrome').manifest.permissions.includes('offscreen'), 'chrome: offscreen');
    assert.ok(!ff.permissions.includes('offscreen'), 'firefox: no offscreen');
    assert.match(ff.content_security_policy.extension_pages, /frame-src 'self'/);
    assert.match(
      built('chrome').manifest.content_security_policy.extension_pages,
      /frame-src 'none'/,
    );
    // Every script the built background.js imports on Chrome is on that list (a flag
    // that's off takes its imports with it: Extension Alerts' src/alerts.js).
    const bg = read('chrome', 'src/background.js');
    const imported = [...bg.matchAll(/importScripts\(([^)]*)\)/g)].flatMap((m) =>
      [...m[1].matchAll(/'([^']+)'/g)].map((x) => `src/${x[1]}`),
    );
    assert.ok(imported.length >= 5, imported.join(', '));
    for (const f of imported) assert.ok(ff.background.scripts.includes(f), `${f} on Firefox`);
    assert.deepEqual(
      ff.content_scripts,
      [
        {
          matches: ALL_PAGES,
          js: ['src/site-bridge.js'],
          run_at: 'document_start',
          all_frames: false,
        },
      ],
      "Firefox's one-click Connect and Local Mode: the site bridge on our own pages, top frame only",
    );
    assert.match(
      read('firefox', 'src/site-bridge.js'),
      /const PAGES = \["https:\/\/hangar\.openhangar\.space","https:\/\/openhangar\.space","https:\/\/app\.openhangar\.space"\];/,
      "the bridge's own copy of the list",
    );
    assert.ok(!fs.existsSync(path.join(dir, 'dist/chrome/src/site-bridge.js')));
    assert.deepEqual(ff.browser_specific_settings.gecko.data_collection_permissions, {
      required: ['none'],
      optional: SYNC_DATA,
    });
    assert.match(check(dir), /clean store build \(sync built in to production/);
    // The source copy keeps its defaults.
    assert.equal(fs.readFileSync(path.join(dir, 'src', 'flags.js'), 'utf8'), FLAGS_SRC);

    // A developer's build with a dev-only flag on: built, and the store check refuses it.
    assert.match(pack(dir, ['--flag', 'orgFleet=on']), /dev build, never for a store/);
    assert.deepEqual(built('chrome').flags, { ...STORE, orgFleet: true });
    assert.match(built('chrome').probe, /orgFleetOnly\(\);/);
    assert.throws(() => check(dir), /flag "orgFleet" is on, and it's dev-only/);

    // OH_SYNC=1, --sync and --flag sync=on are the store build now.
    for (const [args, env] of [[[], { OH_SYNC: '1' }], [['--sync']], [['--flag', 'sync=on']]]) {
      assert.doesNotMatch(pack(dir, args, env), /dev build/);
      assert.deepEqual(built('chrome').flags, STORE);
      assert.match(built('chrome').lib, /OH\.siteLinkStart\s*=/, 'sync code kept');
      assert.match(check(dir), /clean store build/);
    }

    // Local Mode asks Firefox through sync's consent card, and the connector's popup and
    // scans are Local Mode's: on top of the store build, sync=off or localMode=off alone
    // doesn't build.
    assert.throws(() => pack(dir, ['--flag', 'sync=off']), /localMode=on needs sync on/);
    assert.throws(() => pack(dir, ['--flag', 'localMode=off']), /connector=on needs localMode on/);
    // Store alerts show in the popup: not without the connector.
    assert.throws(() => pack(dir, ['--flag', 'connector=off']), /alerts=on needs the connector/);

    // Without sync (so without Local Mode and the connector): a developer's build with the
    // sync code cut, which the store check refuses. The identity permission stays (it's
    // in manifest.json).
    const NO_SYNC = ['--flag', 'sync=off', '--flag', 'localMode=off', ...NO_CONNECTOR];
    assert.match(pack(dir, NO_SYNC), /dev build, never for a store/);
    for (const t of ['chrome', 'firefox']) {
      const b = built(t);
      assert.deepEqual(
        b.flags,
        {
          ...STORE,
          sync: false,
          localMode: false,
          connector: false,
          wishlistImport: false,
          alerts: false,
        },
        t,
      );
      assert.ok(!/OH\.siteLinkStart\s*=/.test(b.lib), `${t}: sync code cut`);
      // Add to RSI Cart still lets our own site in; no page may Connect.
      assert.deepEqual(b.pages.connect, [], t);
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
      () => pack(dir, [...NO_SYNC, '--site=https://staging.openhangar.space']),
      /needs sync on/,
    );

    // A developer's staging build: built in to staging, which lets staging's pages in
    // too, its hangar page included, and lets the connector's pages ask it. Never for a
    // store.
    const staging = pack(dir, ['--site=https://staging.openhangar.space']);
    assert.match(staging, /syncing to https:\/\/staging\.openhangar\.space.*dev build/);
    assert.match(built('chrome').lib, /SITE_BUILT_IN = "https:\/\/staging\.openhangar\.space"/);
    assert.ok(
      built('chrome').manifest.externally_connectable.matches.includes(
        'https://staging.openhangar.space/*',
      ),
    );
    assert.match(
      built('chrome').manifest.content_security_policy.extension_pages,
      /; connect-src 'self' https:\/\/robertsspaceindustries\.com https:\/\/openhangar\.space https:\/\/staging\.openhangar\.space$/,
    );
    assert.throws(() => check(dir), /the staging site/);
    // As npm run build:staging builds it (Local Mode named, though it's the default now).
    const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'))).scripts;
    assert.match(
      scripts['build:staging'],
      /pack\.mjs --sync --site=https:\/\/staging\.openhangar\.space --flag localMode=on$/,
    );
    pack(dir, ['--site=https://staging.openhangar.space', '--flag', 'localMode=on']);
    assert.deepEqual(built('firefox').pages.hangar, [
      'https://hangar.openhangar.space',
      'https://hangar-staging.openhangar.space',
    ]);
    assert.throws(() => check(dir), /hangar-staging\.openhangar\.space|the staging site/);

    // A developer's build without the connector (the dashboard, as every store build had
    // before 0.3.0): no popup and no basic page, the popup's Scan cut, Local Mode kept.
    // The store check refuses it for the flag alone.
    assert.match(pack(dir, NO_CONNECTOR), /dev build, never for a store/);
    for (const t of ['chrome', 'firefox']) {
      const m = built(t).manifest;
      assert.equal(m.action.default_popup, undefined, t);
      for (const f of ['popup.html', 'basic.html'])
        assert.ok(!fs.existsSync(path.join(dir, 'dist', t, 'src', f)), `${t}: no ${f}`);
      assert.ok(fs.existsSync(path.join(dir, 'dist', t, 'src', 'dashboard.html')), t);
      assert.doesNotMatch(m.content_security_policy.extension_pages, /connect-src/, t);
      const bg = read(t, 'src/background.js');
      assert.ok(!/ohPopup/.test(bg), `${t}: the popup's Scan cut`);
      assert.match(bg, /oh-get-hangar/, `${t}: Local Mode kept`);
    }
    const offDefault = (flags) =>
      ['chrome', 'firefox'].flatMap((t) =>
        flags.map((f) => `dist/${t}/src/flags.js: flag "${f}" is off, the store default is on`),
      );
    assert.deepEqual(
      problemsOf(dir).sort(),
      offDefault(['alerts', 'connector', 'wishlistImport']).sort(),
    );

    // Without Local Mode too: the hangar page in no list and its requests cut; the store
    // check minds the flags, not the pages. One that lets the hangar page in anyway is
    // refused for that as well.
    pack(dir, [...NO_CONNECTOR, '--flag', 'localMode=off']);
    const OUR_SITE = ['https://openhangar.space/*', 'https://app.openhangar.space/*'];
    assert.deepEqual(built('chrome').manifest.externally_connectable.matches, OUR_SITE);
    assert.deepEqual(built('firefox').manifest.content_scripts[0].matches, OUR_SITE);
    assert.deepEqual(built('chrome').pages.hangar, []);
    assert.ok(!/oh-get-hangar|scanRequest/.test(read('chrome', 'src/background.js')));
    assert.deepEqual(
      problemsOf(dir).sort(),
      offDefault(['alerts', 'connector', 'localMode', 'wishlistImport']).sort(),
    );
    const pagesFile = path.join(dir, 'dist', 'chrome', 'src', 'site-pages.js');
    fs.writeFileSync(
      pagesFile,
      fs
        .readFileSync(pagesFile, 'utf8')
        .replace('"hangar":[]', '"hangar":["https://hangar.openhangar.space"]'),
    );
    const m = built('chrome').manifest;
    m.externally_connectable.matches.unshift('https://hangar.openhangar.space/*');
    fs.writeFileSync(path.join(dir, 'dist', 'chrome', 'manifest.json'), JSON.stringify(m));
    assert.ok(problemsOf(dir).includes('chrome: the hangar page with localMode off'));

    // The beta: exactly the beta set, no overrides. It's the store's (the connector with
    // Local Mode), so the production hangar page is let in and the toolbar opens the popup.
    pack(dir, ['--beta']);
    assert.deepEqual(built('beta').flags, STORE);
    assert.deepEqual(built('beta-firefox').flags, STORE);
    assert.deepEqual(built('beta').pages.hangar, ['https://hangar.openhangar.space']);
    for (const t of ['beta', 'beta-firefox'])
      assert.equal(built(t).manifest.action.default_popup, 'src/popup.html', t);
    assert.throws(() => pack(dir, ['--beta', '--flag', 'orgFleet=on']), /beta set/);
    assert.throws(() => pack(dir, ['--flag', 'warpDrive=on']), /no such flag/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Bridge v2's way in: the manifest's list and the two built copies must agree, with
// exact patterns, no ids, the bridge in the top frame only, and exactly the store's
// pages for the build's flags (scripts/site-pages.mjs).
test('store check: the way in agrees with itself, or the build is refused', () => {
  const dir = scratchRepo();
  const file = (target, f) => path.join(dir, 'dist', target, f);
  const edit = (target, f, change) => {
    const text = fs.readFileSync(file(target, f), 'utf8');
    if (!f.endsWith('.json')) return fs.writeFileSync(file(target, f), change(text));
    const json = JSON.parse(text);
    change(json);
    fs.writeFileSync(file(target, f), JSON.stringify(json));
  };
  // The store build has Local Mode (src/flags.js): our hangar page is in its lists.
  // (The other way round, the hangar page in a build without it: the pack test.)
  const noHangarLists = (t) =>
    t.replace('"hangar":["https://hangar.openhangar.space"]', '"hangar":[]');
  const cases = [
    [
      'another site let in',
      () =>
        edit('chrome', 'manifest.json', (m) =>
          m.externally_connectable.matches.push('https://evil.example/*'),
        ),
      /^chrome: externally_connectable \(.*evil\.example.*\) doesn't agree with src\/site-pages\.js/,
    ],
    [
      'other extensions let in',
      () => edit('chrome', 'manifest.json', (m) => (m.externally_connectable.ids = ['*'])),
      /^chrome: externally_connectable has more than matches/,
    ],
    [
      'a wildcard host',
      () =>
        edit(
          'chrome',
          'manifest.json',
          (m) => (m.externally_connectable.matches = ['https://*.openhangar.space/*']),
        ),
      /^chrome: externally_connectable .* doesn't agree/,
    ],
    [
      'the bridge in every frame',
      () => edit('firefox', 'manifest.json', (m) => (m.content_scripts[0].all_frames = true)),
      /^firefox: the site bridge runs in frames/,
    ],
    [
      "the bridge's own list",
      () =>
        edit('firefox', 'src/site-bridge.js', (t) =>
          t.replace('const PAGES = [', 'const PAGES = ["https://evil.example",'),
        ),
      /^firefox: src\/site-bridge\.js's own list .* doesn't agree/,
    ],
    [
      'no hangar page with Local Mode on',
      () => {
        edit('chrome', 'src/site-pages.js', noHangarLists);
        edit('chrome', 'manifest.json', (m) =>
          m.externally_connectable.matches.splice(
            m.externally_connectable.matches.indexOf('https://hangar.openhangar.space/*'),
            1,
          ),
        );
      },
      /^chrome: no hangar page with localMode on/,
    ],
    [
      'Connect on the public front page',
      () =>
        edit('chrome', 'src/site-pages.js', (t) =>
          t.replace(
            '"connect":["https://app',
            '"connect":["https://openhangar.space","https://app',
          ),
        ),
      /^chrome: Connect on https:\/\/openhangar\.space/,
    ],
  ];
  try {
    for (const [what, tamper, want] of cases) {
      pack(dir);
      assert.deepEqual(problemsOf(dir), [], `${what}: the build itself passes`);
      tamper();
      const out = problemsOf(dir);
      assert.ok(
        out.some((l) => want.test(l)),
        `${what}: ${JSON.stringify(out)}`,
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
