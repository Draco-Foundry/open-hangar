/*
 * Daily canary for RSI site changes: download the public (logged-out) pages and
 * feeds the extension reads, run the extension's own parsers on them, and check
 * the results still look right. Exits 1 and prints a report when something broke,
 * so the workflow can post to #ops before users notice.
 *
 * Run by .github/workflows/canary.yml, or by hand: `npm run canary`.
 * Logged-in pages (hangar, buy-backs, referrals) can't be checked from here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// lib.js is a browser script; give it the globals it expects (empty storage, so
// every getter really downloads).
globalThis.window = globalThis;
globalThis.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
};
createRequire(import.meta.url)(path.join(ROOT, 'src/lib.js'));
const OH = globalThis.OH;

// Remember the last HTTP answer per host, to tell "RSI is down or blocking us"
// from "RSI changed the page".
const lastHttp = new Map();
const UA = 'OpenHangar-canary (+https://openhangar.space)';
const fetchLogged = async (url, init = {}) => {
  const host = new URL(url).host;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'user-agent': UA, ...(init.headers || {}) },
      signal: AbortSignal.timeout(30000),
    });
    lastHttp.set(host, `HTTP ${res.status}`);
    return res;
  } catch (e) {
    lastHttp.set(host, e?.name === 'TimeoutError' ? 'timed out' : 'no connection');
    throw e;
  }
};
const reachable = (host) => /^HTTP [23]/.test(lastHttp.get(host) || '');

const share = (list, pred) => (list.length ? list.filter(pred).length / list.length : 0);
const checks = [
  {
    name: 'Store ship list (upgrade tool feed)',
    host: 'robertsspaceindustries.com',
    async run() {
      const r = await OH.getStoreShips(fetchLogged, { force: true });
      const ships = r?.ships || [];
      if (ships.length < 50) return `${ships.length} ships (expected 50+)`;
      if (!ships.some((s) => s.forSale)) return 'no ship is for sale (parser lost the editions?)';
      this.ships = ships;
      return null;
    },
  },
  {
    name: 'Ship store page (in stock / out / packs)',
    host: 'robertsspaceindustries.com',
    async run() {
      const ship = (checks[0].ships || []).find((s) => s.forSale && s.link);
      if (!ship) return 'skipped: no for-sale ship from the store feed';
      const res = await fetchLogged(ship.link, { credentials: 'omit' });
      if (!res.ok) return `${ship.name} page answered HTTP ${res.status}`;
      const st = OH.parseShipStock(await res.text());
      return st ? null : `couldn't read the offers on ${ship.name}'s page`;
    },
  },
  {
    name: 'Ship matrix (pictures, manufacturers)',
    host: 'robertsspaceindustries.com',
    async run() {
      const res = await fetchLogged('https://robertsspaceindustries.com/ship-matrix/index', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return `answered HTTP ${res.status}`;
      const data = (await res.json())?.data;
      const list = Array.isArray(data) ? data.filter((s) => s && s.name) : [];
      if (list.length < 150) return `${list.length} ships (expected 150+)`;
      const pics = share(list, (s) => s.media?.[0]?.images?.store_small);
      if (pics < 0.8) return `only ${Math.round(pics * 100)}% have a picture`;
      return null;
    },
  },
  {
    name: 'Comm-Links (Latest From RSI)',
    host: 'robertsspaceindustries.com',
    async run() {
      const items = await OH.getRsiNews(fetchLogged);
      if (items.length < 5) return `${items.length} posts (expected 5+)`;
      if (share(items, (i) => i.title && i.url && i.when) < 0.9)
        return 'posts missing title/link/date';
      return null;
    },
  },
  {
    name: 'Patch notes (Spectrum)',
    host: 'robertsspaceindustries.com',
    async run() {
      const items = await OH.getPatchNotes(fetchLogged);
      return items.length ? null : 'no patch notes read';
    },
  },
  {
    name: 'Loaner Ship Matrix (help center)',
    host: 'support.robertsspaceindustries.com',
    async run() {
      const rows = (await OH.getLoanerMatrix(fetchLogged)) || [];
      return rows.length >= 40 ? null : `${rows.length} rows (expected 40+)`;
    },
  },
  {
    name: 'Included Vessels (help center)',
    host: 'support.robertsspaceindustries.com',
    async run() {
      const rows = (await OH.getIncludedVessels(fetchLogged)) || [];
      return rows.length >= 5 ? null : `${rows.length} rows (expected 5+)`;
    },
  },
];

const broken = [];
const down = [];
for (const c of checks) {
  let problem;
  try {
    problem = await c.run.call(c);
  } catch (e) {
    problem = `crashed: ${e?.message || e}`;
  }
  if (problem?.startsWith('skipped')) {
    console.log(`- ${c.name}: ${problem}`);
  } else if (problem) {
    // Can't tell a broken parser from a page we never got: say which.
    const line = `${c.name}: ${problem}`;
    if (reachable(c.host)) broken.push(line);
    else down.push(`${line} (${c.host}: ${lastHttp.get(c.host) || 'no answer'})`);
    console.log(`✘ ${line}`);
  } else {
    console.log(`✔ ${c.name}`);
  }
}

if (broken.length || down.length) {
  const parts = [];
  if (broken.length) {
    parts.push(
      `**RSI may have changed their site.** These parsers need a look:\n- ${broken.join('\n- ')}`,
    );
  }
  if (down.length)
    parts.push(`**Couldn't reach RSI** (down, or blocking us):\n- ${down.join('\n- ')}`);
  parts.push('Playbook: docs/RSI-CHANGES.md');
  const report = parts.join('\n\n');
  console.log('\n' + report);
  // The workflow posts this to #ops.
  if (process.env.CANARY_REPORT) fs.writeFileSync(process.env.CANARY_REPORT, report);
  process.exit(1);
}
console.log('\nAll public RSI sources parse as expected.');
