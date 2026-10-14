'use strict';
// The connector's basic page (ui/basic/rows.js, ui/basic/copy.js, ui/basic/report-lines.js):
// rows, search, totals and the CSV export, which must work from what's stored alone, and
// the scan's words. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { pledge, buyback } = require('./stored-data.js');

const rows = () => import('../ui/basic/rows.js');

test('pledge and buy-back rows: the fields the page shows, nothing fetched', async () => {
  const { pledgeRow, buybackRow, kindLabel } = await rows();
  const p = pledgeRow(pledge(3));
  assert.equal(p.id, '40000003');
  assert.equal(p.value, 113);
  assert.equal(p.insurance, 'LTI');
  assert.deepEqual(p.contents, ['Test Item 3', 'Lifetime Insurance', 'Test Poster']);
  assert.ok(!JSON.stringify(p).includes('media.robertsspaceindustries'), 'no pictures');
  const c = pledgeRow(pledge(2, { ccu: true }));
  assert.ok(c.hay.includes('test arrow') && c.hay.includes('test hornet 2'), "an upgrade's ships");
  const b = buybackRow(buyback(1));
  assert.equal(b.price, null, 'not read yet: no price');
  const read = buybackRow(buyback(1), { price: 45, insurance: 'LTI' });
  assert.equal(read.price, 45);
  assert.equal(read.insurance, 'LTI');
  // A half-read page (only its value, from history) doesn't count as read.
  assert.equal(buybackRow(buyback(1), { price: 45, partial: true }).price, null);
  assert.equal(kindLabel('ccu'), 'CCU');
  assert.equal(kindLabel('warp-core'), 'Other');
});

test('search: every word, any order, any case; totals of what is shown', async () => {
  const { pledgeRow, search, totals } = await rows();
  const list = [pledge(1), pledge(2), pledge(3, { ship: false })].map(pledgeRow);
  assert.equal(search(list, '').length, 3);
  assert.deepEqual(
    search(list, 'POSTER  item 3').map((r) => r.id),
    ['40000003'],
  );
  assert.equal(search(list, 'cutlass nothing').length, 0);
  assert.deepEqual(totals(list), { count: 3, value: 111 + 112 + 113, priced: 3 });
  assert.deepEqual(totals([{ price: null }, { price: 10.1 }, { price: 0.2 }], 'price'), {
    count: 3,
    value: 10.3,
    priced: 2,
  });
});

test('CSV: quoted where needed, no formulas, one row per shown item', async () => {
  const { csvCell, pledgeRow, pledgesCsv, buybackRow, buybacksCsv, exportName } = await rows();
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell(null), '');
  const csv = pledgesCsv([pledge(1), pledge(2, { ccu: true })].map(pledgeRow));
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines[0], 'id,name,type,value,currency,insurance,giftable,meltable,date,contents');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^40000001,Package - Test Cutlass Black 1,ship,111,USD,LTI,no,yes,/);
  const bb = buybacksCsv([buybackRow(buyback(2), { price: 30 })]);
  assert.equal(bb.split('\r\n')[0], 'id,name,type,date,contains,insurance,price');
  assert.match(bb, /70000002,Test Mustang 2,ship,"Jan 05, 2025",Test Mustang and 2 items,,30/);
  const at = new Date(Date.UTC(2026, 9, 11));
  assert.equal(
    exportName('pledges', 'Test Pilot/1', 'csv', at),
    'open-hangar-pledges-Test_Pilot_1-2026-10-11.csv',
  );
  assert.equal(exportName('backup', '', 'json', at), 'open-hangar-backup-2026-10-11.json');
});

test("basic page copy: the owner's words (2026-10-13), filled in", async () => {
  const { t, KEYS } = await import('../ui/basic/copy.js');
  assert.equal(t('basic.scan'), 'Scan');
  assert.equal(
    t('basic.buyback-totals', { n: 2, value: '$5.00', priced: 1 }),
    '2 buy-backs, $5.00 (1 with a price listed)',
  );
  assert.equal(
    t('basic.switched-new', { who: 'Pilot_A' }),
    'Signed in as Pilot_A on RSI: that account has no scan here yet. Press Scan.',
  );
  assert.throws(() => t('basic.nope'), /no "basic.nope"/);
  for (const k of KEYS) assert.doesNotMatch(t(k), /\[copy:/, k);
});

test("basic page copy: the scan's report rows and the signed-out box (2026-10-13)", async () => {
  const { t } = await import('../ui/basic/copy.js');
  // "Scan complete: ... · referrals read", and "Referrals: read" in the problem box.
  assert.equal(t('basic.row-referrals'), 'referrals read');
  assert.equal(t('basic.row-referrals-box'), 'read');
  // Signed out: a title, and the line under it.
  assert.equal(t('basic.signed-out'), "You're Signed Out of RSI");
  assert.equal(
    t('basic.signed-out-line'),
    'Nothing was scanned, and your saved hangar is safe. Log in on RSI, then scan again.',
  );
  const fs = require('node:fs');
  const page = fs.readFileSync(`${__dirname}/../ui/basic/Basic.svelte`, 'utf8');
  assert.match(
    page,
    /\{r\.name\}: \{r\.box \?\? r\.text\}/,
    "the problem box shows a row's own words",
  );
  assert.match(page, /t\('basic\.signed-out-line'\)/, 'the line under the signed-out title');
  // The rows' words are the page's own (ui/basic/report-lines.js), from the runner's ids.
  const lines = fs.readFileSync(`${__dirname}/../ui/basic/report-lines.js`, 'utf8');
  assert.match(
    lines,
    /box: t\('basic\.row-referrals-box'\)/,
    'the referrals row carries its box words',
  );
});

// --- The scan's words (ui/basic/report-lines.js, from ui/scan/runner.js's report) -------
const runnerReport = (rows, extra = {}) => ({
  v: 1,
  run: 'r',
  by: 'tab',
  reason: 'page',
  startedAt: 1,
  at: 2,
  ms: 1,
  held: null,
  signedOut: false,
  switched: null,
  rows,
  bad: rows.filter((r) => !r.ok || r.partial).length,
  sync: null,
  ...extra,
});

test("the scan's report in the basic page's words, as before the runner", async () => {
  const { t } = await import('../ui/basic/copy.js');
  const { reportLines, reportSummary } = await import('../ui/basic/report-lines.js');
  const fine = reportLines(
    runnerReport([
      { id: 'hangar', ok: true, partial: null, n: 2, error: null },
      { id: 'buybacks', ok: true, partial: null, n: 0, error: null },
      { id: 'referrals', ok: true, partial: null, n: null, error: null },
    ]),
    t,
  );
  assert.deepEqual(fine, {
    rows: [
      { name: 'Hangar', ok: true, text: '2 pledges' },
      { name: 'Buy-Backs', ok: true, text: '0 buy-backs' },
      { name: 'Referrals', ok: true, text: 'referrals read', box: 'read' },
    ],
    signedOut: false,
    bad: 0,
  });
  assert.equal(
    `${t('basic.scan-done')} ${fine.rows.map((r) => r.text).join(' · ')}`,
    'Scan complete: 2 pledges · 0 buy-backs · referrals read',
  );
  // A part cut short is a problem; a failed one shows its own words.
  const trouble = reportLines(
    runnerReport([
      { id: 'hangar', ok: true, partial: 'stopped at page 3', n: 1, error: null },
      { id: 'buybacks', ok: false, partial: null, n: null, error: 'RSI changed something' },
    ]),
    t,
  );
  assert.deepEqual(trouble.rows, [
    { name: 'Hangar', ok: false, text: '1 pledge' },
    { name: 'Buy-Backs', ok: false, text: 'RSI changed something' },
  ]);
  assert.equal(trouble.bad, 2);
  assert.equal(reportSummary(trouble), 'Hangar: problem · Buy-Backs: problem');
  // Signed out: no rows, the title says so.
  const out = reportLines(runnerReport([], { signedOut: true }), t);
  assert.deepEqual(out, { rows: [], signedOut: true, bad: 0 });
  assert.equal(reportSummary(out, true), 'signed out of RSI');
  assert.equal(reportSummary(null), 'no scan this session');
  // A scan that never ran (another tab's scan, no RSI access) leaves the last one up.
  assert.equal(reportLines(runnerReport([], { held: 'busy' }), t), null);
  assert.equal(reportLines(runnerReport([], { held: 'no-rsi' }), t), null);
  assert.equal(reportLines(null, t), null);
});

test("the scan's progress line, in the basic page's words", async () => {
  const { t } = await import('../ui/basic/copy.js');
  const { progressLine } = await import('../ui/basic/report-lines.js');
  const p = (part, page = null, count = null, retry = null) => ({ part, page, count, retry });
  assert.equal(progressLine(p('start'), t), 'Asking RSI for your hangar.');
  assert.equal(progressLine(p('account'), t), 'Asking RSI for your hangar.');
  assert.equal(progressLine(p('hangar', 2, 20), t), 'Hangar: page 2, 20 so far');
  assert.equal(progressLine(p('buybacks', 1, 5), t), 'Buy-Backs: page 1, 5 so far');
  assert.equal(
    progressLine(p('hangar', 3, 30, { attempt: 1, of: 3 }), t),
    'Hangar: page 3. RSI stalled, trying again (1 of 3)',
  );
  assert.equal(progressLine(p('referrals', null, 12), t), 'Referrals: 12 so far');
  assert.equal(progressLine(p('packs', 1, 30), t), '');
});

test('basic page copy: one pledge, one buy-back', async () => {
  const { t, KEYS } = await import('../ui/basic/copy.js');
  assert.equal(t('basic.row-pledges', { n: 1 }), '1 pledge');
  assert.equal(t('basic.row-pledges', { n: 0 }), '0 pledges');
  assert.equal(t('basic.row-pledges', { n: 12 }), '12 pledges');
  assert.equal(t('basic.row-buybacks', { n: 1 }), '1 buy-back');
  assert.equal(t('basic.row-buybacks', { n: 3 }), '3 buy-backs');
  assert.equal(t('basic.account-line', { n: 1, when: 'today' }), '1 pledge, last scan today');
  assert.equal(t('basic.account-line', { n: 40, when: 'today' }), '40 pledges, last scan today');
  assert.equal(
    t('basic.buyback-totals', { n: 1, value: '$5.00', priced: 1 }),
    '1 buy-back, $5.00 (1 with a price listed)',
  );
  assert.equal(t('basic.csv-saved', { n: 1 }), 'Saved 1 row to a CSV file.');
  assert.equal(t('basic.csv-saved', { n: 7 }), 'Saved 7 rows to a CSV file.');
  // A key with no singular words keeps its own for 1.
  assert.equal(t('basic.show-all', { n: 1 }), 'Show All 1');
  // Every singular sits beside its key and fills the same parts.
  const parts = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).join();
  for (const k of KEYS.filter((k) => k.endsWith('.one'))) {
    const base = k.slice(0, -'.one'.length);
    assert.ok(KEYS.includes(base), k);
    assert.equal(parts(t(k)), parts(t(base)), k);
  }
});

// --- The wishlist into the account, once (ui/scan/wishlist-import.js) --------------------
const wish = () => import('../ui/scan/wishlist-import.js');
function memStore(data) {
  return {
    data,
    get: async (keys) =>
      Object.fromEntries(
        []
          .concat(keys)
          .filter((k) => k in data)
          .map((k) => [k, structuredClone(data[k])]),
      ),
    set: async (o) => void Object.assign(data, structuredClone(o)),
  };
}
const LINK = { token: 'tok', name: 'pilot', connectedAt: 1000, lastSync: null };
const SITE = 'https://app.openhangar.space';

test('wishlist import: what goes, cleaned, each once, in order', async () => {
  const { wishItems, MAX_ITEMS } = await wish();
  assert.deepEqual(
    wishItems([
      'Cutlass Black',
      ' cutlass black ',
      { id: 'sku-12', kind: 'paint', name: 'Stormbringer Paint', img: 'x', price: 15 },
      { id: 'upgrade-7', kind: 'ccu', name: 'Upgrade', from: 'Avenger Titan', to: 'Cutlass Black' },
      { id: 'upgrade-7', kind: 'ccu', name: 'Upgrade', from: 'Arrow' },
      { id: 'upgrade-8', kind: 'ccu', name: 'No start' },
      { id: 'evil', kind: 'pack', name: 'x' },
      { id: 'sku-1', kind: 'spaceship', name: 'x' },
      42,
      '',
    ]),
    [
      { kind: 'ship', name: 'Cutlass Black' },
      { kind: 'paint', id: 'sku-12', name: 'Stormbringer Paint' },
      { kind: 'ccu', id: 'upgrade-7', name: 'Upgrade', from: 'Avenger Titan', to: 'Cutlass Black' },
      { kind: 'ccu', id: 'upgrade-7', name: 'Upgrade', from: 'Arrow' },
    ],
  );
  assert.equal(wishItems(Array.from({ length: 900 }, (_, i) => `Ship ${i}`)).length, MAX_ITEMS);
  assert.deepEqual(wishItems(null), []);
});

test('wishlist import: sent once per connection, never deletes, retried later', async () => {
  const { importWishlist, IMPORT_PATH, RETRY_MS } = await wish();
  const sent = [];
  let status = 404;
  const fetchFn = async (url, init) => {
    sent.push({ url, init });
    return { ok: status < 300, status };
  };
  const store = memStore({ siteLink: LINK, wishlist: ['Cutlass Black'] });
  const go = (now) => importWishlist({ store, fetchFn, siteUrl: SITE, appVersion: '0.3.0', now });
  // The website doesn't take it yet: later, and not again for 6 hours.
  assert.equal(await go(5000), 'later');
  assert.equal(await go(5000 + RETRY_MS - 1), 'waiting');
  assert.equal(sent.length, 1);
  status = 200;
  assert.equal(await go(5000 + RETRY_MS), 'done');
  assert.equal(sent.length, 2);
  const { url, init } = sent[1];
  assert.equal(url, `${SITE}${IMPORT_PATH}`);
  assert.equal(init.method, 'POST');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.headers.authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(init.body), {
    v: 1,
    appVersion: '0.3.0',
    items: [{ kind: 'ship', name: 'Cutlass Black' }],
  });
  // Done for this connection: never again, and the wishlist here is still there.
  assert.equal(await go(9e12), 'skip');
  assert.equal(sent.length, 2);
  assert.deepEqual(store.data.wishlist, ['Cutlass Black']);
  // A new connection (Disconnect, Connect again) sends it once more; the website's union
  // makes that harmless.
  store.data.siteLink = { ...LINK, connectedAt: 2000 };
  assert.equal(await go(9e12), 'done');
  assert.equal(sent.length, 3);
});

test('wishlist import: nothing to send, not connected, no network', async () => {
  const { importWishlist } = await wish();
  const fetchFn = async () => {
    throw new Error('offline');
  };
  const empty = memStore({ siteLink: LINK, wishlist: [] });
  assert.equal(await importWishlist({ store: empty, fetchFn, siteUrl: SITE }), 'empty');
  assert.equal(empty.data.wishImport.done > 0, true);
  const none = memStore({ wishlist: ['Cutlass Black'] });
  assert.equal(await importWishlist({ store: none, fetchFn, siteUrl: SITE }), 'skip');
  const offline = memStore({ siteLink: LINK, wishlist: ['Cutlass Black'] });
  assert.equal(await importWishlist({ store: offline, fetchFn, siteUrl: SITE }), 'later');
  assert.equal(offline.data.wishImport.status, 0);
  assert.ok(!JSON.stringify(offline.data.wishImport).includes('tok'), 'no token kept beside it');
});

test("the pledges total line, in the owner's words (2026-10-12)", async () => {
  const { pledgeTotalsLine } = await import('../ui/basic/rows.js');
  const money = (n) => `$${n.toFixed(2)}`;
  assert.equal(
    pledgeTotalsLine({ count: 12, value: 345.5, priced: 11 }, money),
    '12 pledges, $345.50 melt (11 with melt listed)',
  );
  assert.equal(
    pledgeTotalsLine({ count: 1, value: 45, priced: 1 }, money),
    '1 pledge, $45.00 melt (1 with melt listed)',
  );
  assert.equal(
    pledgeTotalsLine({ count: 1200, value: 0, priced: 0 }, money),
    '1,200 pledges, $0.00 melt (0 with melt listed)',
  );
});
