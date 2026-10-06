/*
 * Refresh src/data/ship-catalog.json, the ship list (names, class names, store
 * prices, role, size, crew, cargo) bundled with the extension so hangar value
 * shows instantly and works offline. Data: the Star Citizen Wiki API
 * (api.star-citizen.wiki), English fields only. Run weekly by
 * .github/workflows/ship-catalog.yml, or by hand: `npm run update:ships`.
 *
 * Only this script (on GitHub, never in anyone's browser) talks to the wiki: the
 * extension itself reads the bundled list plus openhangar.space/api/ships, which
 * the website builds from this same file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/ship-catalog.json');
const SC_API = 'https://api.star-citizen.wiki/api/v2';

// lib.js is a browser script; give it the globals it expects.
globalThis.window = globalThis;
globalThis.chrome ??= {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
};
createRequire(import.meta.url)(path.join(ROOT, 'src/lib.js'));
const OH = globalThis.OH;

// Walk one paged wiki endpoint and return every record's slim entry. The API
// serves 50 per page whatever we ask for, so walk until last_page. Politely: one
// page at a time with a pause between them.
async function fetchAllPages(endpoint, fetchFn, pause) {
  const list = [];
  for (let page = 1; page <= 12; page++) {
    if (page > 1) await pause();
    const res = await fetchFn(`${SC_API}/${endpoint}?page%5Bsize%5D=200&page%5Bnumber%5D=${page}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'OpenHangarShipCatalog/1.0' },
    });
    // A failed page means an incomplete list: throw, so nothing half-empty is written.
    if (!res.ok) throw new Error(`${endpoint} page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    for (const v of data) {
      const slim = OH.slimVehicle(v);
      if (slim) list.push(slim);
    }
    const last =
      (json.meta && json.meta.last_page) || (json.links && json.links.next ? page + 1 : page);
    if (!data.length || page >= last) break;
  }
  return list;
}

// The whole ship list, slimmed. `vehicles` is what's in the game files
// (flight-ready ships, ground vehicles); `shipmatrix` is RSI's ship matrix, which
// adds concept ships (Pioneer, Odyssey, …) and fills prices/status the first list
// lacks. Both halves or nothing (OH.mergeCatalogs merges them).
export async function fetchShipCatalog(
  fetchFn = globalThis.fetch,
  pause = () => new Promise((r) => setTimeout(r, 1000)),
) {
  const list = await fetchAllPages('vehicles', fetchFn, pause);
  const matrix = await fetchAllPages('shipmatrix/vehicles', fetchFn, pause);
  return OH.mergeCatalogs(list, matrix);
}

async function main() {
  const list = await fetchShipCatalog();
  if (list.length < 200) {
    console.error(`Only ${list.length} vehicles came back; not overwriting the snapshot.`);
    process.exit(1);
  }
  list.sort((a, b) => a.slug.localeCompare(b.slug));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const same = prev && JSON.stringify(prev.list) === JSON.stringify(list);
  if (same) {
    console.log(`No changes (${list.length} vehicles).`);
    return;
  }
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
