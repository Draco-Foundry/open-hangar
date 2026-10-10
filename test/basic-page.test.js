'use strict';
// The connector's basic page (ui/basic/rows.js, ui/basic/copy.js): rows, search,
// totals and the CSV export, which must work from what's stored alone. Run: `npm test`.
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

test('basic page copy: placeholders, filled in', async () => {
  const { t, KEYS } = await import('../ui/basic/copy.js');
  assert.equal(t('basic.scan'), '[copy: basic.scan]');
  assert.equal(
    t('basic.pledge-totals', { n: 2, value: '$5.00' }),
    '[copy: basic.pledge-totals 2 $5.00]',
  );
  assert.throws(() => t('basic.nope'), /no "basic.nope"/);
  for (const k of KEYS) assert.match(t(k), new RegExp(`^\\[copy: ${k.replace('.', '\\.')}`), k);
});

// --- The wishlist into the account, once (ui/basic/wishlist-import.js) -------------------
const wish = () => import('../ui/basic/wishlist-import.js');
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
