// Store build guard: fails if a packed build carries anything its store item must not.
//
//   node scripts/check-store-build.mjs [dir]          the public Open Hangar (npm run pack)
//   node scripts/check-store-build.mjs --beta [dir]   Open Hangar Beta (npm run build:beta)
//
// dir defaults to dist. Every text file is read, inside the zips too (they're what the
// stores get).
//
// Public build: no sync code (app.openhangar.space), no built-in sync site and no
// staging site anywhere (the manifest included), and the public name and version,
// never the beta's. The manifest's externally_connectable is left out of the sync
// check: it lists our own site on purpose, for Add to RSI Cart from the website's
// store (#288). So does the Firefox build's site-bridge content script, its way to
// the same pages (#434).
//
// Beta build (docs/BETA.md), both of them (dist/beta for Chrome and Edge,
// dist/beta-firefox for Firefox): sync code kept and built in to production
// (app.openhangar.space) and nothing else; the staging site nowhere, manifest
// included; the Open Hangar Beta name, amber icons, a four-number version and a
// "0.3.0 Beta 1" style version_name; the identity permission for Connect. Firefox's
// also has the beta's own add-on id (never the public one), the update_url its
// self-distributed copies update from, and the optional data collection sync asks for.
//
// Both: every build carries src/flags.js with exactly its set of build flags (the
// registry's defaults, or its beta set), and no flag the registry marks dev-only
// is on (docs/FLAGS.md).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildValues, loadFlags, readRegistry } from './build-flags.mjs';

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

const problems = [];
const TEXT = /\.(js|mjs|html|json|css)$/;
const STAGING = /staging\.openhangar\.space/;
const BUILT_IN = /SITE_BUILT_IN\s*=\s*(['"`])((?:(?!\1).)*)\1/g;

// A store manifest never mentions staging at all, under any name.
function noStagingManifest(name, text) {
  if (name.endsWith('manifest.json') && /staging/i.test(text))
    problems.push(`${name}: mentions staging (store manifests never do)`);
}

function checkPublic(name, text) {
  if (STAGING.test(text)) problems.push(`${name}: the staging site`);
  noStagingManifest(name, text);
  let hosts = text;
  if (name.endsWith('manifest.json')) {
    const m = JSON.parse(text);
    if (m.name !== '__MSG_extName__')
      problems.push(`${name}: name is "${m.name}", not the public one`);
    if (m.version_name)
      problems.push(`${name}: has a version_name (${m.version_name}): a beta build?`);
    delete m.externally_connectable;
    // Firefox's way to the same pages (src/site-bridge.js, #434).
    if (m.content_scripts)
      m.content_scripts = m.content_scripts.filter(
        (c) => !(c.js || []).every((f) => f.endsWith('site-bridge.js')),
      );
    hosts = JSON.stringify(m);
  }
  if (/app\.openhangar\.space/.test(hosts))
    problems.push(`${name}: sync code (an OH_SYNC=1 build)`);
  for (const [, , site] of text.matchAll(BUILT_IN))
    if (site) problems.push(`${name}: a built-in sync site (${site})`);
}

// Which beta a file is from: the Firefox folder or zip, or Chrome and Edge's.
const betaOf = (name) =>
  /(^|\/)(beta-firefox\/|open-hangar-beta-firefox-)/.test(name) ? 'firefox' : 'chrome';
const seen = {
  chrome: { builtIn: 0, sync: false, manifests: 0 },
  firefox: { builtIn: 0, sync: false, manifests: 0 },
};
function checkBeta(name, text) {
  const firefox = betaOf(name) === 'firefox';
  const saw = seen[firefox ? 'firefox' : 'chrome'];
  if (STAGING.test(text)) problems.push(`${name}: the staging site`);
  noStagingManifest(name, text);
  if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(text) && /SITE_BUILT_IN/.test(text))
    problems.push(`${name}: a local dev site`);
  for (const [, , site] of text.matchAll(BUILT_IN)) {
    if (site !== PRODUCTION_SITE) problems.push(`${name}: built in to "${site}", not production`);
    else saw.builtIn++;
  }
  // The sync code itself (lib.js's @sync block), not just an address.
  if (name.endsWith('lib.js') && /OH\.siteLinkStart\s*=/.test(text)) saw.sync = true;
  if (name.endsWith('manifest.json')) {
    saw.manifests++;
    const m = JSON.parse(text);
    if (m.name !== BETA_NAME) problems.push(`${name}: name is "${m.name}", not "${BETA_NAME}"`);
    const v = String(m.version || '').split('.');
    if (v.length !== 4 || !v.every((p) => /^\d+$/.test(p) && +p <= 65535))
      problems.push(`${name}: version "${m.version}" isn't four dotted numbers`);
    if (!/^\d+\.\d+\.\d+ Beta \d+$/.test(m.version_name || ''))
      problems.push(`${name}: version_name "${m.version_name}" isn't like "0.3.0 Beta 1"`);
    if (!(m.permissions || []).includes('identity'))
      problems.push(`${name}: no identity permission (Connect's sign-in window needs it)`);
    if (firefox) checkBetaFirefox(name, m);
    else {
      const ec = (m.externally_connectable && m.externally_connectable.matches) || [];
      if (!ec.includes(`${PRODUCTION_SITE}/*`))
        problems.push(`${name}: externally_connectable doesn't let in ${PRODUCTION_SITE}`);
      if (m.browser_specific_settings)
        problems.push(`${name}: a Firefox manifest in the Chrome and Edge beta`);
    }
  }
}
function checkBetaFirefox(name, m) {
  const gecko = (m.browser_specific_settings && m.browser_specific_settings.gecko) || {};
  if (gecko.id !== BETA_FIREFOX_ID)
    problems.push(`${name}: add-on id "${gecko.id}", not the beta's "${BETA_FIREFOX_ID}"`);
  if (gecko.update_url !== BETA_FIREFOX_UPDATES)
    problems.push(`${name}: update_url "${gecko.update_url}", not ${BETA_FIREFOX_UPDATES}`);
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
// The built flags.js: this build's set, nothing dev-only, nothing unknown.
const flagged = { files: 0, manifests: 0 };
function checkFlags(name, text) {
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
const checkBuild = BETA ? checkBeta : checkPublic;
const check = (name, text) => {
  checkBuild(name, text);
  checkFlags(name, text);
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
    if (e.isDirectory()) walk(p, r);
    else if (TEXT.test(e.name)) check(p, readFileSync(p, 'utf8'));
    else if (e.name.endsWith('.zip')) {
      zips[BETA ? betaOf(r) : 'chrome']++;
      let list;
      try {
        list = execFileSync('unzip', ['-Z1', p], { encoding: 'utf8' }).split('\n');
      } catch {
        problems.push(`${p}: couldn't list the zip (is unzip installed?)`);
        continue;
      }
      for (const f of list.filter((f) => TEXT.test(f)))
        check(`${p}:${f}`, execFileSync('unzip', ['-p', p, f], { encoding: 'utf8' }));
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
    const saw = seen[browser];
    if (saw.manifests && !saw.builtIn) problems.push(`${dir}: sync is not built in to production`);
    if (saw.manifests && !saw.sync) problems.push(`${dir}: the sync code is missing`);
  }
}
if (problems.length) {
  console.error(`✖ Not a ${BETA ? 'beta' : 'public store'} build:\n  ${problems.join('\n  ')}`);
  console.error(
    BETA
      ? 'Rebuild with npm run build:beta.'
      : 'Rebuild with npm run build (or npm run pack) before releasing.',
  );
  process.exit(1);
}
console.log(
  BETA
    ? `✔ ${root} has clean Open Hangar Beta builds for Chrome, Edge and Firefox (synced to production, no staging)`
    : `✔ ${root} is a clean store build (no staging site, no sync code, store flags)`,
);
