/*
 * Refresh src/data/ship-catalog.json, the ship list (names, class names, store
 * prices, role, size, crew, cargo) bundled with the extension so hangar value
 * shows instantly and works offline. Data: the Star Citizen Wiki API
 * (api.star-citizen.wiki), English fields only. Run weekly by
 * .github/workflows/ship-catalog.yml, or by hand: `npm run update:ships`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/ship-catalog.json');

// lib.js is a browser script; give it the globals it expects.
globalThis.window = globalThis;
globalThis.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
};
createRequire(import.meta.url)(path.join(ROOT, 'src/lib.js'));
const OH = globalThis.OH;

const list = await OH.fetchShipCatalog(globalThis.fetch);
if (list.length < 200) {
  console.error(`Only ${list.length} vehicles came back; not overwriting the snapshot.`);
  process.exit(1);
}
list.sort((a, b) => a.slug.localeCompare(b.slug));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const same = prev && JSON.stringify(prev.list) === JSON.stringify(list);
if (same) {
  console.log(`No changes (${list.length} vehicles).`);
} else {
  const out = {
    source:
      'https://api.star-citizen.wiki/api/v2/vehicles + /shipmatrix/vehicles (Star Citizen Wiki community)',
    fetched: new Date().toISOString().slice(0, 10),
    count: list.length,
    list,
  };
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
  const priced = list.filter((v) => v.msrp).length;
  console.log(`Wrote ${list.length} vehicles (${priced} priced) to src/data/ship-catalog.json`);
}
