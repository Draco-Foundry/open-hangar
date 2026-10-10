// Store build guard: fails if a packed build carries anything its store item must not.
//
//   node scripts/check-store-build.mjs [dir]          the public Open Hangar (npm run pack)
//   node scripts/check-store-build.mjs --beta [dir]   Open Hangar Beta (npm run build:beta)
//
// dir defaults to dist. Every text file is read, inside the zips too (they're what the
// stores get). Each folder and each zip is checked as a build of its own.
//
// Public build: the public name and version, never the beta's.
//
// Beta build (docs/BETA.md), both of them (dist/beta for Chrome and Edge,
// dist/beta-firefox for Firefox): the Open Hangar Beta name, amber icons, a four-number
// version and a "0.3.0 Beta 1" style version_name. Firefox's also has the beta's own
// add-on id (never the public one) and the update_url its self-distributed copies
// update from.
//
// Both: no staging site anywhere (the manifest included). Sync, while the `sync` flag
// is on for the build (src/flags.js; on by default, so in the public build too): the
// sync code, built in to production (app.openhangar.space) and nothing else, the
// identity permission for Connect, and the website's way in to the extension:
// externally_connectable on Chrome and Edge, the site-bridge content script on Firefox
// (#434), with the optional data collection sync asks for. With sync off: no sync code
// (app.openhangar.space) and no built-in sync site; the manifest's
// externally_connectable and Firefox's site bridge still list our own site on purpose,
// for Add to RSI Cart from the website's store (#288).
//
// And every build carries src/flags.js with exactly its set of build flags (the
// registry's defaults, or its beta set), and no flag the registry marks dev-only
// is on (docs/FLAGS.md).
//
// Our pages' way in (bridge v2, scripts/site-pages.mjs): the manifest's list
// (externally_connectable on Chrome and Edge with exact https://host/* patterns and
// nothing else, no `ids`; on Firefox the one site bridge, top frame only), the built
// src/site-pages.js and the Firefox bridge's own copy all agree, and they're exactly the
// store's pages for the build's flags: openhangar.space and app.openhangar.space,
// Connect on the app with sync on, and hangar.openhangar.space only with localMode on.
// This holds with localMode on (the beta) and off (the public build).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildValues, loadFlags, readRegistry } from './build-flags.mjs';
import {
  pagesFor,
  pagesProblems,
  readBridgePages,
  readPages,
  withoutPageLists,
} from './site-pages.mjs';

const args = process.argv.slice(2);
const BETA = args.includes('--beta');
const root = args.find((a) => !a.startsWith('--')) || 'dist';
const PRODUCTION_SITE = 'https://app.openhangar.space';
const BETA_NAME = 'Open Hangar Beta';
const BETA_FIREFOX_ID = 'open-hangar-beta@draco-foundry';
const BETA_FIREFOX_UPDATES = `${PRODUCTION_SITE}/beta/firefox-updates.json`;
// What sync sends, in Firefox's categories (scripts/pack.mjs SYNC_DATA).
const SYNC_DATA = ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'];
// The repo's registry, wherever this is run from.
const REGISTRY = readRegistry(fileURLToPath(new URL('../src/flags.js', import.meta.url)));
const WANT_FLAGS = buildValues(REGISTRY, { beta: BETA });
const SYNC = WANT_FLAGS.sync;

const problems = [];
const TEXT = /\.(js|mjs|html|json|css)$/;
const STAGING = /staging\.openhangar\.space/;
const BUILT_IN = /SITE_BUILT_IN\s*=\s*(['"`])((?:(?!\1).)*)\1/g;

// What each build (a folder in dir, or a zip) turned out to carry.
const builds = {};
const buildOf = (unit) =>
  (builds[unit] ??= {
    firefox: /firefox/.test(unit),
    manifests: 0,
    builtIn: 0,
    sync: false,
    // What its way in was built with (scripts/site-pages.mjs).
    manifest: null,
    pages: null,
    bridge: null,
    flags: null,
  });

// A store manifest never mentions staging at all, under any name.
function noStagingManifest(name, text) {
  if (name.endsWith('manifest.json') && /staging/i.test(text))
    problems.push(`${name}: mentions staging (store manifests never do)`);
}

function checkPublic(name, text) {
  if (!name.endsWith('manifest.json')) return;
  const m = JSON.parse(text);
  if (m.name !== '__MSG_extName__')
    problems.push(`${name}: name is "${m.name}", not the public one`);
  if (m.version_name)
    problems.push(`${name}: has a version_name (${m.version_name}): a beta build?`);
}

function checkBeta(name, text, build) {
  if (!name.endsWith('manifest.json')) return;
  const m = JSON.parse(text);
  if (m.name !== BETA_NAME) problems.push(`${name}: name is "${m.name}", not "${BETA_NAME}"`);
  const v = String(m.version || '').split('.');
  if (v.length !== 4 || !v.every((p) => /^\d+$/.test(p) && +p <= 65535))
    problems.push(`${name}: version "${m.version}" isn't four dotted numbers`);
  if (!/^\d+\.\d+\.\d+ Beta \d+$/.test(m.version_name || ''))
    problems.push(`${name}: version_name "${m.version_name}" isn't like "0.3.0 Beta 1"`);
  if (!build.firefox) return;
  const gecko = (m.browser_specific_settings && m.browser_specific_settings.gecko) || {};
  if (gecko.id !== BETA_FIREFOX_ID)
    problems.push(`${name}: add-on id "${gecko.id}", not the beta's "${BETA_FIREFOX_ID}"`);
  if (gecko.update_url !== BETA_FIREFOX_UPDATES)
    problems.push(`${name}: update_url "${gecko.update_url}", not ${BETA_FIREFOX_UPDATES}`);
}

// A build with sync: the code, production built in, and Connect's way in.
function checkSync(name, text, build) {
  if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(text) && /SITE_BUILT_IN/.test(text))
    problems.push(`${name}: a local dev site`);
  for (const [, , site] of text.matchAll(BUILT_IN)) {
    if (site !== PRODUCTION_SITE) problems.push(`${name}: built in to "${site}", not production`);
    else build.builtIn++;
  }
  // The sync code itself (lib.js's @sync block), not just an address.
  if (name.endsWith('lib.js') && /OH\.siteLinkStart\s*=/.test(text)) build.sync = true;
  if (!name.endsWith('manifest.json')) return;
  const m = JSON.parse(text);
  if (!(m.permissions || []).includes('identity'))
    problems.push(`${name}: no identity permission (Connect's sign-in window needs it)`);
  if (build.firefox) checkSyncFirefox(name, m);
  else {
    const ec = (m.externally_connectable && m.externally_connectable.matches) || [];
    if (!ec.includes(`${PRODUCTION_SITE}/*`))
      problems.push(`${name}: externally_connectable doesn't let in ${PRODUCTION_SITE}`);
    if (m.browser_specific_settings)
      problems.push(`${name}: a Firefox manifest in the Chrome and Edge build`);
  }
}
function checkSyncFirefox(name, m) {
  const gecko = (m.browser_specific_settings && m.browser_specific_settings.gecko) || {};
  const dc = gecko.data_collection_permissions;
  if (!dc) problems.push(`${name}: no data_collection_permissions (AMO requires them)`);
  else {
    if (JSON.stringify(dc.required) !== JSON.stringify(['none']))
      problems.push(
        `${name}: data collection required is ${JSON.stringify(dc.required)}, not ["none"]`,
      );
    if (JSON.stringify(dc.optional) !== JSON.stringify(SYNC_DATA))
      problems.push(`${name}: optional data collection isn't sync's (${SYNC_DATA.join(', ')})`);
  }
  if (!gecko.strict_min_version) problems.push(`${name}: no strict_min_version`);
  if (!(m.background && m.background.scripts))
    problems.push(`${name}: no background.scripts (Firefox runs an event page)`);
  if (m.externally_connectable)
    problems.push(`${name}: externally_connectable (Firefox uses src/site-bridge.js)`);
  const bridge = (m.content_scripts || []).find((c) => (c.js || []).includes('src/site-bridge.js'));
  if (!bridge || !bridge.matches.includes(`${PRODUCTION_SITE}/*`))
    problems.push(`${name}: no site-bridge content script for ${PRODUCTION_SITE}`);
}

// A build without sync: no sync code and no built-in site. The manifest's
// externally_connectable and Firefox's site bridge (#434) list our own site for Add to
// RSI Cart (#288), so they're left out of the address check.
function checkNoSync(name, text) {
  let hosts = withoutPageLists(text);
  if (name.endsWith('manifest.json')) {
    const m = JSON.parse(text);
    delete m.externally_connectable;
    if (m.content_scripts)
      m.content_scripts = m.content_scripts.filter(
        (c) => !(c.js || []).every((f) => f.endsWith('site-bridge.js')),
      );
    hosts = JSON.stringify(m);
  }
  if (/app\.openhangar\.space/.test(hosts))
    problems.push(`${name}: sync code, in a build with sync off`);
  for (const [, , site] of text.matchAll(BUILT_IN))
    if (site) problems.push(`${name}: a built-in sync site (${site})`);
}

// The built flags.js: this build's set, nothing dev-only, nothing unknown.
const flagged = { files: 0, manifests: 0 };
function checkFlags(name, text, build) {
  if (name.endsWith('manifest.json')) flagged.manifests++;
  if (!/(^|[/:])src\/flags\.js$/.test(name)) return;
  flagged.files++;
  let values;
  try {
    ({ values } = loadFlags(text, name));
  } catch (e) {
    problems.push(`${name}: unreadable build flags (${e.message})`);
    return;
  }
  build.flags = values;
  for (const [flag, on] of Object.entries(values)) {
    if (!(flag in REGISTRY))
      problems.push(`${name}: flag "${flag}" isn't in src/flags.js (stale?)`);
    else if (on && REGISTRY[flag].devOnly)
      problems.push(`${name}: flag "${flag}" is on, and it's dev-only (src/flags.js)`);
    else if (on !== WANT_FLAGS[flag])
      problems.push(
        `${name}: flag "${flag}" is ${on ? 'on' : 'off'}, ${BETA ? 'the beta set' : 'the store default'} is ${WANT_FLAGS[flag] ? 'on' : 'off'}`,
      );
  }
  for (const flag of Object.keys(REGISTRY))
    if (!(flag in values)) problems.push(`${name}: flag "${flag}" is missing (stale build?)`);
}
// The way in's three copies, collected per build and checked once all are read.
function collectPages(name, text, build) {
  try {
    if (name.endsWith('manifest.json')) build.manifest = JSON.parse(text);
    else if (/(^|[/:])src\/site-pages\.js$/.test(name)) build.pages = readPages(text, name);
    else if (/(^|[/:])src\/site-bridge\.js$/.test(name)) build.bridge = readBridgePages(text, name);
  } catch (e) {
    problems.push(`${name}: unreadable (${e.message})`);
  }
}
function checkPages(unit, build) {
  if (!build.pages) return void problems.push(`${unit}: no src/site-pages.js`);
  if (!build.flags) return; // reported with the flags
  if (build.firefox && !build.bridge) return void problems.push(`${unit}: no src/site-bridge.js`);
  problems.push(...pagesProblems(unit, build));
  const want = pagesFor({ localMode: build.flags.localMode, sync: build.flags.sync });
  if (JSON.stringify(build.pages) !== JSON.stringify(want))
    problems.push(
      `${unit}: its pages ${JSON.stringify(build.pages)} aren't the store's for its flags (${JSON.stringify(want)})`,
    );
}

const check = (name, text, unit) => {
  const build = buildOf(unit);
  if (name.endsWith('manifest.json')) build.manifests++;
  if (STAGING.test(text)) problems.push(`${name}: the staging site`);
  noStagingManifest(name, text);
  if (BETA) checkBeta(name, text, build);
  else checkPublic(name, text);
  if (SYNC) checkSync(name, text, build);
  else checkNoSync(name, text);
  checkFlags(name, text, build);
  collectPages(name, text, build);
};

// Beta: only its own folders and zips. Public: everything in dist.
const wanted = (rel) =>
  !BETA ||
  /^beta(-firefox)?(\/|$)/.test(rel) ||
  /^open-hangar-beta(-firefox)?-[\d.]+\.zip$/.test(rel);
const zips = { chrome: 0, firefox: 0 };
function walk(dir, rel = '') {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (!wanted(r)) continue;
    // The build a file belongs to: its top folder in dir, or its zip.
    const unit = r.split('/')[0];
    if (e.isDirectory()) walk(p, r);
    else if (TEXT.test(e.name)) check(p, readFileSync(p, 'utf8'), unit);
    else if (e.name.endsWith('.zip')) {
      zips[/firefox/.test(r) ? 'firefox' : 'chrome']++;
      let list;
      try {
        list = execFileSync('unzip', ['-Z1', p], { encoding: 'utf8' }).split('\n');
      } catch {
        problems.push(`${p}: couldn't list the zip (is unzip installed?)`);
        continue;
      }
      for (const f of list.filter((f) => TEXT.test(f)))
        check(`${p}:${f}`, execFileSync('unzip', ['-p', p, f], { encoding: 'utf8' }), r);
      if (BETA)
        for (const f of list.filter((f) => /^icons\/icon\d+\.png$/.test(f)))
          if (!execFileSync('unzip', ['-p', p, f]).equals(readFileSync(`beta/${f}`)))
            problems.push(`${p}:${f}: not the beta icon (beta/${f})`);
    }
  }
}

if (!existsSync(root)) {
  console.error(`✖ ${root} doesn't exist: build first`);
  process.exit(1);
}
walk(root);
if (flagged.files < flagged.manifests)
  problems.push(
    `${root}: a build without src/flags.js (${flagged.files} for ${flagged.manifests} builds)`,
  );
if (BETA) {
  for (const [browser, dir, zip] of [
    ['chrome', 'beta', 'open-hangar-beta-<version>.zip'],
    ['firefox', 'beta-firefox', 'open-hangar-beta-firefox-<version>.zip'],
  ]) {
    if (!existsSync(`${root}/${dir}/manifest.json`)) problems.push(`${root}/${dir}: no beta build`);
    if (!zips[browser]) problems.push(`${root}: no ${zip}`);
  }
}
if (SYNC)
  for (const [unit, build] of Object.entries(builds)) {
    if (!build.manifests) continue;
    if (!build.builtIn) problems.push(`${unit}: sync is not built in to production`);
    if (!build.sync) problems.push(`${unit}: the sync code is missing`);
  }
for (const [unit, build] of Object.entries(builds)) if (build.manifest) checkPages(unit, build);
if (problems.length) {
  console.error(`✖ Not a ${BETA ? 'beta' : 'public store'} build:\n  ${problems.join('\n  ')}`);
  console.error(
    BETA
      ? 'Rebuild with npm run build:beta.'
      : 'Rebuild with npm run build (or npm run pack) before releasing.',
  );
  process.exit(1);
}
const what = SYNC ? 'sync built in to production, no staging' : 'no staging site, no sync code';
console.log(
  BETA
    ? `✔ ${root} has clean Open Hangar Beta builds for Chrome, Edge and Firefox (${what})`
    : `✔ ${root} is a clean store build (${what}, store flags)`,
);
