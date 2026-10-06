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
 */

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const RUNTIME = ['_locales', 'icons', 'src'];

// Sync to app.openhangar.space isn't launched, and the privacy policy says nothing
// leaves your device, so store builds don't carry its code at all (#187). Lines from
// a "@sync-start" marker through "@sync-end" are cut. OH_SYNC=1 (or --sync) keeps
// them, for developers testing sync locally (with the `siteUrl` storage key, or
// pre-pointed at staging by `npm run build:staging`).
const args = process.argv.slice(2);
const KEEP_SYNC = process.env.OH_SYNC === '1' || args.includes('--sync');

// `npm run build:staging` (--site=<url> or OH_SITE=<url>): a dev build with sync
// on and pointed at that site, written into lib.js's SITE_BUILT_IN, so nobody has to
// set the `siteUrl` storage key by hand. Dev builds only: it needs sync kept, and
// scripts/check-store-build.mjs fails any release or publish whose build carries it.
const SITE =
  (args.find((a) => a.startsWith('--site=')) || '').slice('--site='.length) ||
  process.env.OH_SITE ||
  '';
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
const SYNC_FILES = ['src/lib.js', 'src/dashboard.js', 'src/dashboard.html'];
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
        data_collection_permissions: { required: ['none'] },
      },
      gecko_android: { strict_min_version: '142.0' },
    },
  }),
};

rmSync('dist', { recursive: true, force: true });
for (const [name, transform] of Object.entries(targets)) {
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
  writeFileSync(`${out}/manifest.json`, JSON.stringify(transform(base), null, 2) + '\n');
  if (!KEEP_SYNC) {
    for (const f of SYNC_FILES) stripSync(`${out}/${f}`);
    assertNoSyncHost(`${out}/src`);
  }
  if (SITE) presetSite(`${out}/src/lib.js`);
  console.log(
    `built ${out}${KEEP_SYNC ? ' (with sync)' : ''}${SITE ? `, syncing to ${SITE} (dev build, never for a store)` : ''}`,
  );
}
