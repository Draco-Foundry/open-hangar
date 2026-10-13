/*
 * Daily canary for RSI site changes: download the public (logged-out) pages and
 * feeds the extension reads, run the extension's own parsers on them, and check
 * the results still look right. Exits 1 and prints a report when something broke,
 * so the workflow can post to #ops before users notice.
 *
 * Run by .github/workflows/canary.yml, or by hand: `npm run canary`.
 * Logged-in pages (hangar, buy-backs, referrals) can't be checked from here.
 * Also checks our own exchange-rates file is live and fresh (#243), and that
 * the saved copies the tests read (test/fixtures) still look like the live
 * pages (#199).
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
// Every OK answer, kept for the fixture check below.
const answers = [];
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
    if (res.ok) answers.push([String(url), res.clone()]);
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
    // Not RSI: our own rates file (#243). Weekends and holidays have no new ECB
    // rates, so up to 5 days old is normal.
    name: 'Exchange rates (openhangar.space/rates.json)',
    host: 'openhangar.space',
    own: true,
    async run() {
      const res = await fetchLogged('https://openhangar.space/rates.json');
      if (!res.ok) return `answered HTTP ${res.status}`;
      const file = await res.json();
      const missing = OH.CURRENCIES.filter((c) => !(file?.rates?.[c] > 0));
      if (missing.length) return `missing ${missing.join(', ')}`;
      const age = (Date.now() - Date.parse(file.date)) / 86400e3;
      return age > 5 ? `rates are from ${file.date} (the daily Pages run may be failing)` : null;
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

// --- Saved test pages (#199) -------------------------------------------------
// The tests run the parsers on saved copies of these pages (test/fixtures). If
// the live page gives different fields than the saved copy, the tests are
// passing on a page RSI no longer serves: save a fresh copy and update the
// test's numbers. Uses the answers the checks above already downloaded.
const fixture = (file) => fs.readFileSync(path.join(ROOT, 'test/fixtures', file), 'utf8');
const liveJson = async (re) => {
  const hit = answers.find(([u]) => re.test(u));
  return hit ? hit[1].clone().json() : null;
};
// Fields set in at least half the rows, so one odd row doesn't count.
function commonFields(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object');
  const seen = new Map();
  for (const r of list)
    for (const [k, v] of Object.entries(r))
      if (v != null && v !== '') seen.set(k, (seen.get(k) || 0) + 1);
  return [...seen]
    .filter(([, n]) => n * 2 >= list.length)
    .map(([k]) => k)
    .sort();
}
const savedPages = [
  {
    file: 'store-ships.json',
    live: async () => OH.parseStoreShips(await liveJson(/upgrade\/graphql/)),
    saved: () => OH.parseStoreShips(JSON.parse(fixture('store-ships.json'))),
  },

  {
    file: 'patch-notes.json',
    live: async () => OH.parsePatchNotes(await liveJson(/forum\/channel\/threads/)),
    saved: () => OH.parsePatchNotes(JSON.parse(fixture('patch-notes.json'))),
  },
  {
    file: 'loaner-matrix.html',
    live: async () =>
      OH.parseLoanerMatrix((await liveJson(/articles\/360003093114/))?.article?.body),
    saved: () => OH.parseLoanerMatrix(fixture('loaner-matrix.html')),
  },
  {
    file: 'included-vessels.html',
    live: async () =>
      OH.parseLoanerMatrix((await liveJson(/articles\/4408770370455/))?.article?.body),
    saved: () => OH.parseLoanerMatrix(fixture('included-vessels.html')),
  },
];
const broken = [];
const down = [];
const ours = [];
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
    if (c.own) ours.push(`${line} (${c.host}: ${lastHttp.get(c.host) || 'no answer'})`);
    else if (reachable(c.host)) broken.push(line);
    else down.push(`${line} (${c.host}: ${lastHttp.get(c.host) || 'no answer'})`);
    console.log(`✘ ${line}`);
  } else {
    console.log(`✔ ${c.name}`);
  }
}

for (const p of savedPages) {
  let live;
  try {
    live = commonFields(await p.live());
  } catch {
    continue; // no live answer: the check above already said so
  }
  if (!live.length) continue;
  const saved = commonFields(p.saved());
  const gone = saved.filter((k) => !live.includes(k));
  const added = live.filter((k) => !saved.includes(k));
  if (gone.length || added.length) {
    const what = [
      added.length && `live now has ${added.join(', ')}`,
      gone.length && `live no longer has ${gone.join(', ')}`,
    ];
    ours.push(
      `Saved test page out of date: test/fixtures/${p.file}: ${what.filter(Boolean).join('; ')}`,
    );
    console.log(`✘ saved copy ${p.file} is out of date`);
  } else console.log(`✔ saved copy ${p.file}`);
}

if (broken.length || down.length || ours.length) {
  const parts = [];
  if (ours.length) parts.push(`**Our own files need a look:**\n- ${ours.join('\n- ')}`);
  if (broken.length) {
    parts.push(
      `**RSI may have changed their site.** These parsers need a look:\n- ${broken.join('\n- ')}`,
    );
  }
  if (down.length)
    parts.push(`**Couldn't reach RSI** (down, or blocking us):\n- ${down.join('\n- ')}`);
  if (broken.length || down.length) parts.push('Playbook: docs/RSI-CHANGES.md');
  const report = parts.join('\n\n');
  console.log('\n' + report);
  // The workflow posts this to #ops.
  if (process.env.CANARY_REPORT) fs.writeFileSync(process.env.CANARY_REPORT, report);
  process.exit(1);
}
console.log('\nAll public RSI sources parse as expected.');
