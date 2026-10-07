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
// Beta build (docs/BETA.md): sync code kept and built in to production
// (app.openhangar.space) and nothing else; the staging site nowhere, manifest
// included; the Open Hangar Beta name, amber icons, a four-number version and a
// "0.3.0 Beta 1" style version_name; the identity permission for Connect.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const BETA = args.includes('--beta');
const root = args.find((a) => !a.startsWith('--')) || 'dist';
const PRODUCTION_SITE = 'https://app.openhangar.space';
const BETA_NAME = 'Open Hangar Beta';

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

const seen = { builtIn: 0, sync: false, manifests: 0 };
function checkBeta(name, text) {
  if (STAGING.test(text)) problems.push(`${name}: the staging site`);
  noStagingManifest(name, text);
  if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(text) && /SITE_BUILT_IN/.test(text))
    problems.push(`${name}: a local dev site`);
  for (const [, , site] of text.matchAll(BUILT_IN)) {
    if (site !== PRODUCTION_SITE) problems.push(`${name}: built in to "${site}", not production`);
    else seen.builtIn++;
  }
  // The sync code itself (lib.js's @sync block), not just an address.
  if (name.endsWith('lib.js') && /OH\.siteLinkStart\s*=/.test(text)) seen.sync = true;
  if (name.endsWith('manifest.json')) {
    seen.manifests++;
    const m = JSON.parse(text);
    if (m.name !== BETA_NAME) problems.push(`${name}: name is "${m.name}", not "${BETA_NAME}"`);
    const v = String(m.version || '').split('.');
    if (v.length !== 4 || !v.every((p) => /^\d+$/.test(p) && +p <= 65535))
      problems.push(`${name}: version "${m.version}" isn't four dotted numbers`);
    if (!/^\d+\.\d+\.\d+ Beta \d+$/.test(m.version_name || ''))
      problems.push(`${name}: version_name "${m.version_name}" isn't like "0.3.0 Beta 1"`);
    if (!(m.permissions || []).includes('identity'))
      problems.push(`${name}: no identity permission (Connect's sign-in window needs it)`);
    const ec = (m.externally_connectable && m.externally_connectable.matches) || [];
    if (!ec.includes(`${PRODUCTION_SITE}/*`))
      problems.push(`${name}: externally_connectable doesn't let in ${PRODUCTION_SITE}`);
    if (m.browser_specific_settings)
      problems.push(`${name}: a Firefox manifest (beta is Chrome and Edge)`);
  }
}
const check = BETA ? checkBeta : checkPublic;

// Beta: only its own folder and zip. Public: everything in dist.
const wanted = (rel) =>
  !BETA || rel === 'beta' || rel.startsWith('beta/') || /^open-hangar-beta-[\d.]+\.zip$/.test(rel);
let zips = 0;
function walk(dir, rel = '') {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (!wanted(r)) continue;
    if (e.isDirectory()) walk(p, r);
    else if (TEXT.test(e.name)) check(p, readFileSync(p, 'utf8'));
    else if (e.name.endsWith('.zip')) {
      zips++;
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
if (BETA) {
  if (!existsSync(`${root}/beta/manifest.json`)) problems.push(`${root}/beta: no beta build`);
  if (!zips) problems.push(`${root}: no open-hangar-beta-<version>.zip`);
  if (seen.manifests && !seen.builtIn) problems.push('sync is not built in to production');
  if (seen.manifests && !seen.sync) problems.push('the sync code is missing');
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
    ? `✔ ${root} has a clean Open Hangar Beta build (synced to production, no staging)`
    : `✔ ${root} is a clean store build (no staging site, no sync code)`,
);
