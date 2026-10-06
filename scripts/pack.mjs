/*
 * pack.mjs — build store-ready bundles.
 * ---------------------------------------------------------------------------
 * Copies only the runtime files (manifest, _locales, icons, src) into dist/<target>/ and
 * writes a per-browser manifest. `npm run pack` then zips each with web-ext.
 *
 *   chrome   — manifest.json as-is. Same zip goes to Chrome Web Store + Edge.
 *   firefox  — adds background.scripts (Firefox MV3 runs an event page, not a
 *              service worker) and browser_specific_settings.gecko (add-on id +
 *              the "no data collected" declaration AMO requires).
 *
 * Kept out of manifest.json itself so Chrome doesn't warn about unknown keys.
 *
 * --beta (npm run build:beta): the separate, unlisted "Open Hangar Beta" item instead
 * (docs/BETA.md). Chrome target only, into dist/beta/: its own name, amber icons
 * (beta/icons/), the version from beta/beta.json, and sync on, built in to production
 * (app.openhangar.space). Never the staging site. The public listing never gets it:
 * different name, version scheme and store item. scripts/check-store-build.mjs --beta
 * checks it.
 */

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const RUNTIME = ['_locales', 'icons', 'src'];

const args = process.argv.slice(2);
const BETA = args.includes('--beta');
// The beta's one site. Staging is never built in to anything a store gets.
const PRODUCTION_SITE = 'https://app.openhangar.space';

// Sync to app.openhangar.space isn't launched, and the privacy policy says nothing
// leaves your device, so store builds don't carry its code at all (#187). Lines from
// a "@sync-start" marker through "@sync-end" are cut. OH_SYNC=1 (or --sync) keeps
// them, for developers testing sync locally (with the `siteUrl` storage key, or
// pre-pointed at staging by `npm run build:staging`). The beta always keeps them.
const KEEP_SYNC = BETA || process.env.OH_SYNC === '1' || args.includes('--sync');

// A built-in sync site, written into lib.js's SITE_BUILT_IN so nobody has to set the
// `siteUrl` storage key by hand: production for --beta, or --site=<url> / OH_SITE=<url>
// for a dev build (`npm run build:staging`). The public store build never has one
// (scripts/check-store-build.mjs).
const SITE_ARG =
  (args.find((a) => a.startsWith('--site=')) || '').slice('--site='.length) ||
  process.env.OH_SITE ||
  '';
if (BETA && SITE_ARG) throw new Error('--beta always syncs to production; drop --site / OH_SITE');
const SITE = BETA ? PRODUCTION_SITE : SITE_ARG;
if (SITE) {
  if (!KEEP_SYNC) throw new Error('--site / OH_SITE needs sync kept (--sync or OH_SYNC=1)');
  if (!/^(https:\/\/[a-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/i.test(SITE))
    throw new Error(`--site / OH_SITE must be an https:// origin (or http://localhost): ${SITE}`);
}
const SITE_LINE = "const SITE_BUILT_IN = '';";
function presetSite(file) {
  const src = readFileSync(file, 'utf8');
  if (src.split(SITE_LINE).length !== 2) throw new Error(`${file}: expected one "${SITE_LINE}"`);
  writeFileSync(file, src.replace(SITE_LINE, `const SITE_BUILT_IN = ${JSON.stringify(SITE)};`));
}

// The beta's version (beta/beta.json). Chrome and Edge only take one to four dotted
// numbers (each 0 to 65535) as `version`, so the beta counts 0.3.0.1, 0.3.0.2, ... and
// `version_name` ("0.3.0 Beta 1") is what people see.
function betaVersion() {
  const b = JSON.parse(readFileSync('beta/beta.json', 'utf8'));
  const parts = String(b.version || '').split('.');
  if (parts.length !== 4 || !parts.every((p) => /^(0|[1-9]\d{0,4})$/.test(p) && +p <= 65535))
    throw new Error(
      `beta/beta.json: version must be four dotted numbers, e.g. 0.3.0.1 (got "${b.version}")`,
    );
  if (!/^\d+\.\d+\.\d+ Beta \d+$/.test(b.version_name || ''))
    throw new Error(
      `beta/beta.json: version_name must read like "0.3.0 Beta 1" (got "${b.version_name}")`,
    );
  return b;
}
const BETA_NAME = 'Open Hangar Beta';
// ≤132 characters (Chrome's limit); the store's short description comes from it.
const BETA_DESCRIPTION =
  'Beta build of Open Hangar for invited testers: your Star Citizen hangar, made useful, with opt-in sync to openhangar.space.';
const SYNC_FILES = ['src/lib.js', 'src/dashboard.js', 'src/dashboard.html', 'src/background.js'];
function stripSync(file) {
  const out = [];
  let inside = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.includes('@sync-start')) {
      if (inside) throw new Error(`${file}: @sync-start inside another sync block`);
      inside = true;
    } else if (line.includes('@sync-end')) {
      if (!inside) throw new Error(`${file}: @sync-end without @sync-start`);
      inside = false;
    } else if (!inside) out.push(line);
  }
  if (inside) throw new Error(`${file}: @sync-start never closed`);
  writeFileSync(file, out.join('\n'));
}
// Belt and braces: no store build may still talk to the sync site.
function assertNoSyncHost(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) assertNoSyncHost(p);
    else if (
      /\.(js|html|json)$/.test(e.name) &&
      readFileSync(p, 'utf8').includes('app.openhangar.space')
    ) {
      throw new Error(`${p} still mentions app.openhangar.space; wrap it in @sync-start/@sync-end`);
    }
  }
}
const base = JSON.parse(readFileSync('manifest.json', 'utf8'));

// What sync sends (the same payload as the JSON backup: RSI handle and org, balances
// and pledge prices, hangar and buy-back contents), in Firefox's data-collection
// categories. Optional, because sync is opt-in: Firefox asks on the first Connect
// (src/dashboard.js, siteDataOk). Keep the two lists the same (test/firefox-data.test.js).
const SYNC_DATA = ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'];

const targets = {
  chrome: (m) => m,
  firefox: (m) => ({
    ...m,
    background: { scripts: [m.background.service_worker] },
    browser_specific_settings: {
      gecko: {
        id: 'open-hangar@draco-foundry',
        // data_collection_permissions landed in Firefox 140 (Android 142).
        strict_min_version: '140.0',
        data_collection_permissions: KEEP_SYNC
          ? { required: ['none'], optional: SYNC_DATA }
          : { required: ['none'] },
      },
      gecko_android: { strict_min_version: '142.0' },
    },
  }),
};

// The beta is one Chrome-and-Edge zip; the public build is both browsers.
const builds = BETA ? { beta: targets.chrome } : targets;
const beta = BETA ? betaVersion() : null;

rmSync('dist', { recursive: true, force: true });
for (const [name, transform] of Object.entries(builds)) {
  const out = `dist/${name}`;
  mkdirSync(out, { recursive: true });
  for (const dir of RUNTIME) cpSync(dir, `${out}/${dir}`, { recursive: true });
  // icon.svg is the design source, not a runtime asset.
  rmSync(`${out}/icons/icon.svg`, { force: true });
  // Release notes for the dashboard's Updates page.
  cpSync('CHANGELOG.md', `${out}/CHANGELOG.md`);
  // License terms and third-party notices travel with every copy.
  cpSync('LICENSE', `${out}/LICENSE`);
  cpSync('THIRD_PARTY_NOTICES.md', `${out}/THIRD_PARTY_NOTICES.md`);
  const manifest = { ...transform(base) }; // a copy: chrome returns `base` itself
  // Sync's sign-in window (identity.launchWebAuthFlow) needs "identity": only builds
  // that carry sync ask for it, so store builds' permissions don't change before launch.
  if (KEEP_SYNC) manifest.permissions = [...manifest.permissions, 'identity'];
  // Our own site may talk to the extension (src/background.js): Add to RSI Cart from
  // the website's store in every build (#288; no account, nothing sent anywhere but
  // RSI), and Connect This Browser in builds with sync. Chrome and Edge only; Firefox
  // doesn't let web pages reach extensions. The background worker reads this list
  // back as the only origins it answers.
  if (name !== 'firefox')
    manifest.externally_connectable = {
      // The store is at openhangar.space/store and app.openhangar.space/store.
      // The beta leaves staging out: it talks to production only.
      matches: [
        'https://openhangar.space/*',
        'https://app.openhangar.space/*',
        'https://staging.openhangar.space/*',
      ].filter((m) => !(BETA && m.includes('staging'))),
    };
  if (beta) {
    // Its own store item: a name, icons and version line of its own, so testers can
    // tell it apart and it never stands in for the public Open Hangar.
    manifest.name = BETA_NAME;
    manifest.description = BETA_DESCRIPTION;
    manifest.version = beta.version;
    manifest.version_name = beta.version_name;
    manifest.action = { ...manifest.action, default_title: BETA_NAME };
    for (const f of readdirSync('beta/icons').filter((f) => f.endsWith('.png')))
      cpSync(`beta/icons/${f}`, `${out}/icons/${f}`);
  }
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  if (!KEEP_SYNC) {
    for (const f of SYNC_FILES) stripSync(`${out}/${f}`);
    assertNoSyncHost(`${out}/src`);
  }
  if (SITE) presetSite(`${out}/src/lib.js`);
  console.log(
    `built ${out}${KEEP_SYNC ? ' (with sync)' : ''}${SITE ? `, syncing to ${SITE}` : ''}` +
      (beta ? ` as ${BETA_NAME} ${beta.version} (${beta.version_name})` : '') +
      (SITE && !beta ? ' (dev build, never for a store)' : ''),
  );
}
