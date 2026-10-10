/*
 * pack.mjs — build store-ready bundles.
 * ---------------------------------------------------------------------------
 * Copies only the runtime files (manifest, _locales, icons, src) into dist/<target>/ and
 * writes a per-browser manifest. `npm run pack` then zips each with web-ext.
 *
 *   chrome   — manifest.json as-is. Same zip goes to Chrome Web Store + Edge.
 *   firefox  — adds background.scripts (Firefox MV3 runs an event page, not a
 *              service worker) and browser_specific_settings.gecko (add-on id +
 *              the data collection declaration AMO requires: none required, what
 *              sync sends optional).
 *
 * Kept out of manifest.json itself so Chrome doesn't warn about unknown keys.
 *
 * Both carry sync (the `sync` flag is on by default), built in to production
 * (app.openhangar.space). Sync is opt-in: nothing is sent until you Connect.
 *
 * --beta (npm run build:beta): the separate, unlisted "Open Hangar Beta" instead
 * (docs/BETA.md), into dist/beta/ (Chrome and Edge) and dist/beta-firefox/ (a
 * self-distributed Firefox add-on): its own name, amber icons (beta/icons/), the
 * version from beta/beta.json, and sync on, built in to production
 * (app.openhangar.space). Never the staging site. The public listing never gets it:
 * different name, version scheme, store item and Firefox add-on id.
 * scripts/check-store-build.mjs --beta checks both.
 *
 * Build flags (src/flags.js, docs/FLAGS.md): each build's values go into its copy of
 * src/flags.js, and the code of every flag that's off is cut. Store builds get the
 * registry's defaults, --beta the beta set, and --flag name=on (or =off, repeatable)
 * is for developers' own builds (--sync / OH_SYNC=1 are the older --flag sync=on).
 */

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  FLAGS_FILE,
  buildValues,
  parseFlagArgs,
  readRegistry,
  stripFlagsInDir,
  writeFlags,
} from './build-flags.mjs';

const RUNTIME = ['_locales', 'icons', 'src'];

const args = process.argv.slice(2);
const BETA = args.includes('--beta');
// The sync site of every store build, the beta's included. Staging is never built in
// to anything a store gets.
const PRODUCTION_SITE = 'https://app.openhangar.space';

// This build's flags (src/flags.js): the store defaults or the beta set, then the
// developer's own. A beta is always exactly the beta set.
const REGISTRY = readRegistry(FLAGS_FILE);
const OVERRIDES = parseFlagArgs(args, REGISTRY);
if (BETA && Object.keys(OVERRIDES).length)
  throw new Error('--beta always builds the beta set of flags; drop --flag');
if (!BETA && (process.env.OH_SYNC === '1' || args.includes('--sync'))) OVERRIDES.sync ??= true;
const FLAGS = buildValues(REGISTRY, { beta: BETA, overrides: OVERRIDES });
const FLAGS_ON = Object.keys(FLAGS).filter((f) => FLAGS[f]);
const DEV_ONLY_ON = FLAGS_ON.filter((f) => REGISTRY[f].devOnly);
// Flags set away from the store defaults (--flag): a developer's build.
const OFF_DEFAULT = !BETA && Object.keys(FLAGS).some((f) => FLAGS[f] !== REGISTRY[f].default);

// Sync to app.openhangar.space (#187): the code between a "@sync-start" marker and
// "@sync-end" is the `sync` flag's, on by default, so every store build keeps it (the
// beta too). Sync stays opt-in: nothing is sent until you Connect. A developer's
// `--flag sync=off` build cuts it, and fails if app.openhangar.space is left anywhere.
const KEEP_SYNC = FLAGS.sync;

// The sync site, written into lib.js's SITE_BUILT_IN so nobody has to set the
// `siteUrl` storage key by hand: production in every build with sync, or
// --site=<url> / OH_SITE=<url> for a developer's build (`npm run build:staging`), which
// is never for a store (scripts/check-store-build.mjs).
const SITE_ARG =
  (args.find((a) => a.startsWith('--site=')) || '').slice('--site='.length) ||
  process.env.OH_SITE ||
  '';
if (BETA && SITE_ARG) throw new Error('--beta always syncs to production; drop --site / OH_SITE');
if (SITE_ARG) {
  if (!KEEP_SYNC) throw new Error('--site / OH_SITE needs sync on (drop --flag sync=off)');
  if (!/^(https:\/\/[a-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/i.test(SITE_ARG))
    throw new Error(
      `--site / OH_SITE must be an https:// origin (or http://localhost): ${SITE_ARG}`,
    );
}
const SITE = KEEP_SYNC ? SITE_ARG || PRODUCTION_SITE : '';
// Built in to a site other than production: a developer's build.
const DEV_SITE = Boolean(SITE) && SITE !== PRODUCTION_SITE;
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
// Belt and braces: a build without sync may not still talk to the sync site.
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

// The Firefox beta: an unlisted add-on of its own, so it never replaces the public
// one, signed on AMO and handed out by the website. A self-distributed add-on only
// updates from its update_url: the website hosts that file (Firefox's updates.json
// format, docs/BETA.md) next to the signed .xpi.
const BETA_FIREFOX_ID = 'open-hangar-beta@draco-foundry';
const BETA_FIREFOX_UPDATES = `${PRODUCTION_SITE}/beta/firefox-updates.json`;

// What src/background.js loads with importScripts on Chrome besides flags.js
// (test/build-flags.test.js checks the two lists agree).
const WORKER_SCRIPTS = [
  'src/rsi-cart.js',
  'src/schema-check.js',
  'src/sync-schema.js',
  'src/hangar-shape.js',
];

const targets = {
  chrome: (m) => m,
  firefox: (m, gecko = { id: 'open-hangar@draco-foundry' }) => ({
    ...m,
    // Firefox's event page has no importScripts, so what background.js imports on
    // Chrome is listed here, before it: flags.js, rsi-cart.js for Add to RSI Cart
    // from the website (through site-bridge.js, #434), and the sync schema with the
    // shared hangar shaping (#441).
    background: { scripts: [FLAGS_FILE, ...WORKER_SCRIPTS, m.background.service_worker] },
    browser_specific_settings: {
      gecko: {
        ...gecko,
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

// Both browsers either way: the beta as one Chrome-and-Edge zip plus a Firefox one.
const builds = BETA
  ? {
      beta: targets.chrome,
      'beta-firefox': (m) =>
        targets.firefox(m, { id: BETA_FIREFOX_ID, update_url: BETA_FIREFOX_UPDATES }),
    }
  : targets;
const FIREFOX = new Set(['firefox', 'beta-firefox']);
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
  // Sync's sign-in window (identity.launchWebAuthFlow) needs "identity": it's in
  // manifest.json, so every build asks for it.
  // Our own site may talk to the extension (src/background.js): Add to RSI Cart from
  // the website's store in every build (#288; no account, nothing sent anywhere but
  // RSI), and Connect This Browser in builds with sync. The background worker reads
  // this list back as the only origins it answers.
  // The store is at openhangar.space/store and app.openhangar.space/store.
  // Staging only in a developer's build pointed at another site (npm run
  // build:staging): never in a store build, the beta included
  // (scripts/check-store-build.mjs).
  const SITE_PAGES = [
    'https://openhangar.space/*',
    'https://app.openhangar.space/*',
    ...(DEV_SITE ? ['https://staging.openhangar.space/*'] : []),
  ];
  // Chrome and Edge: the pages message the extension directly. Firefox doesn't allow
  // that, so there src/site-bridge.js runs on just those pages and passes the
  // messages on (#434, owner 2026-10-07: one-click Connect in every browser). Only
  // the Firefox build carries it.
  if (FIREFOX.has(name))
    manifest.content_scripts = [
      { matches: SITE_PAGES, js: ['src/site-bridge.js'], run_at: 'document_start' },
    ];
  else manifest.externally_connectable = { matches: SITE_PAGES };
  if (!FIREFOX.has(name)) rmSync(`${out}/src/site-bridge.js`, { force: true });
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
  writeFlags(`${out}/${FLAGS_FILE}`, FLAGS);
  stripFlagsInDir(`${out}/src`, FLAGS);
  if (!KEEP_SYNC) assertNoSyncHost(`${out}/src`);
  if (SITE) presetSite(`${out}/src/lib.js`);
  console.log(
    `built ${out}${KEEP_SYNC ? ' (with sync)' : ''}${SITE ? `, syncing to ${SITE}` : ''}` +
      (beta ? ` as ${BETA_NAME} ${beta.version} (${beta.version_name})` : '') +
      (FLAGS_ON.length ? `; flags on: ${FLAGS_ON.join(', ')}` : '') +
      (DEV_SITE || DEV_ONLY_ON.length || OFF_DEFAULT ? ' (dev build, never for a store)' : ''),
  );
}
