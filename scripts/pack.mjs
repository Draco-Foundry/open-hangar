/*
 * pack.mjs — build store-ready bundles.
 * ---------------------------------------------------------------------------
 * Copies only the runtime files (manifest, icons, src) into dist/<target>/ and
 * writes a per-browser manifest. `npm run pack` then zips each with web-ext.
 *
 *   chrome   — manifest.json as-is. Same zip goes to Chrome Web Store + Edge.
 *   firefox  — adds background.scripts (Firefox MV3 runs an event page, not a
 *              service worker) and browser_specific_settings.gecko (add-on id +
 *              the "no data collected" declaration AMO requires).
 *
 * Kept out of manifest.json itself so Chrome doesn't warn about unknown keys.
 */

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const RUNTIME = ['icons', 'src'];
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
  writeFileSync(`${out}/manifest.json`, JSON.stringify(transform(base), null, 2) + '\n');
  console.log(`built ${out}`);
}
