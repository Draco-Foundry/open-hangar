'use strict';
// Order History (the orderHistory build flag): the scan step (src/lib.js readOrderHistory)
// on invented pages in RSI's billing page shape (test/fixtures/orders.sample.html: no real
// data). Nothing is read until the switch is on; the first scan after reads every page,
// paced, resumable, kept only when whole; after that a scan reads from page 1 and stops at
// an order already kept; off stops the reads and the sending and keeps the orders read
// (the approved privacy line) until Clear Data; and what sync sends: only the keys the
// sync format allows, valid against its schema. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

let store = {};
const dom = new JSDOM('');
global.window = globalThis;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = k == null ? Object.keys(store) : Array.isArray(k) ? k : [k];
        return Object.fromEntries(
          keys.filter((x) => x in store).map((x) => [x, structuredClone(store[x])]),
        );
      },
      set: async (o) => Object.assign(store, structuredClone(o)),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
    },
  },
  runtime: { getManifest: () => ({ version: '0.0.0' }) },
};
require('../src/schema-check.js');
require('../src/parser-rules-data.js');
require('../src/parser-rules.js');
require('../src/flags.js');
require('../src/scraper/parser.js');
require('../src/lib.js');
const OH = globalThis.OH;
const RULES = globalThis.OHRules;
const SHAPE = require('../src/hangar-shape.js');
const { validate } = require('../src/schema-check.js');
const SCHEMA = require('../src/sync-schema.js');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'orders.sample.html'), 'utf8');
const ME = { loggedIn: true, nickname: 'TestPilot' };
const noPause = async () => {};
OH.sourcePaused = async () => '';

// One invented order card in RSI's shape: order n, its day, one line.
// Order n was placed on day n after the first: newest first is highest number first.
const dayOf = (n) => new Date(Date.UTC(2015, 0, 1) + n * 86400e3).toISOString().slice(0, 10);
const card = (n, day = dayOf(n)) => {
  const [y, m, d] = day.split('-');
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][Number(m) - 1];
  return `<li><div class="row pledge"><div class="basic-infos clearfix">
    <div class="col date"><span>Order Placed:</span> ${month} ${Number(d)}, ${y} 10:00</div>
    <div class="col"><span>Order Id:</span> TESTORDER${String(n).padStart(4, '0')}</div>
    <div class="col small"><span>Status:</span> CLOSED</div>
    <div class="col small"><span>Payment:</span> PAID</div>
    <div class="col small"><span>Fulfillment:</span> DONE</div></div>
    <div class="more"><table class="billing-summary"><tbody>
    <tr><th>Item</th><th>Price</th><th>Qty.</th><th>Discount</th><th>Total</th></tr>
    <tr><td>Package - Test Ship ${n}</td><td>$10.00 USD</td><td>1</td><td>$0.00 USD</td><td>$10.00 USD</td></tr>
    </tbody></table><div class="payment-wrapper"><div class="right-section"><div class="s-row">
    <strong>Items:</strong>$10.00 USD<br><strong>Additional Discount:</strong>$0.00 USD<br>
    <strong>Credits used:</strong>$0.00 USD<br><strong>Total before Tax:</strong>$10.00 USD<br>
    <strong>Total:</strong>$10.00 USD</div></div></div></div></div></li>`;
};
// A page of cards with RSI's pager (page `page` of `pages`).
const pageHtml = (ns, page, pages) => {
  const links = Array.from(
    { length: pages },
    (_, i) =>
      `<a class="${i + 1 === page ? 'active' : ''}" href="/en/account/billing?page=${i + 1}&amp;pagesize=100">${i + 1}</a>`,
  ).join('');
  return `<html><body><div class="pager js-pager">${links}</div><ul class="orders-item">${ns
    .map((n) => card(n))
    .join('')}</ul></body></html>`;
};
// A fake RSI: orders newest first (highest number first), 100 a page; past the end it
// serves the last page again, as RSI does. `fail` → a status for a call.
function fakeRsi({ count = 0, fail = () => null, html } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const u = new URL(url);
    const page = Number(u.searchParams.get('page'));
    calls.push({ page, url, init });
    const status = fail({ page, n: calls.length });
    if (status) return new Response('', { status });
    if (html) return new Response(html(page), { status: 200 });
    const pages = Math.max(1, Math.ceil(count / 100));
    const p = Math.min(page, pages);
    const ns = [];
    for (let n = count - (p - 1) * 100; n > Math.max(0, count - p * 100); n--) ns.push(n);
    return new Response(pageHtml(ns, p, count ? pages : 0), { status: 200 });
  };
  return { fetchFn, calls };
}
const read = (rsi, more = {}) =>
  OH.readOrderHistory({ account: ME, fetchFn: rsi.fetchFn, pause: noPause, ...more });

test.beforeEach(() => {
  store = {};
});

test('the merge: each order once, the first copy wins, newest day first, capped', () => {
  const a = { id: 'A', date: '2024-01-02', payment: 'PAID', lines: [] };
  const b = { id: 'B', date: '2024-03-01', lines: [] };
  const a2 = { ...a, payment: 'REFUNDED' };
  assert.deepEqual(
    OH.mergeOrders([a2], [a, b, null, { id: '' }]).map((o) => [o.id, o.payment]),
    [
      ['B', undefined],
      ['A', 'REFUNDED'],
    ],
  );
  const many = Array.from({ length: OH.ORDER_MAX + 10 }, (_, n) => ({ id: `O${n}`, lines: [] }));
  assert.equal(OH.mergeOrders(many).length, OH.ORDER_MAX);
});

test('off to start: nothing is read, nothing kept, nothing sent', async () => {
  const rsi = fakeRsi({ count: 5 });
  assert.equal(await OH.orderHistoryOn(), null);
  const r = await read(rsi);
  assert.equal(r.did, 'off');
  assert.equal(rsi.calls.length, 0);
  assert.equal(store.orderHistory, undefined);
  assert.equal(await OH.getOrderHistory(ME), null);
});

test('turned on: the first scan reads every page, paced, the Pledge Store tab, 100 a page', async () => {
  await OH.setOrderHistory(true);
  const rsi = fakeRsi({ count: 250 });
  let pauses = 0;
  const progress = [];
  const r = await read(rsi, {
    pause: async () => pauses++,
    onProgress: (page, pages) => progress.push([page, pages]),
  });
  assert.equal(r.ok, true);
  assert.equal(r.did, 'full');
  assert.deepEqual(
    rsi.calls.map((c) => c.page),
    [1, 2, 3],
  );
  assert.equal(pauses, 2, 'every request after the first waits');
  for (const c of rsi.calls) {
    assert.match(c.url, /^https:\/\/robertsspaceindustries\.com\/en\/account\/billing\?/);
    assert.match(c.url, /storefront=2/);
    assert.match(c.url, /pagesize=100/);
    assert.equal(c.init.credentials, 'include');
    assert.equal(c.init.method, undefined, 'a plain GET');
  }
  assert.deepEqual(progress, [
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  const kept = await OH.getOrderHistory(ME);
  assert.equal(kept.items.length, 250);
  assert.equal(kept.items[0].id, 'TESTORDER0250', 'newest first');
  assert.equal(kept.pages, 3);
  assert.equal(kept.complete, true);
  assert.equal(store.orderHistoryLoad, undefined, 'the read is done');
});

test('no orders at all: one page, kept as an empty history', async () => {
  await OH.setOrderHistory(true);
  const rsi = fakeRsi({ html: () => '<html><body><p>No orders</p></body></html>' });
  const r = await read(rsi);
  assert.equal(r.did, 'full');
  assert.equal(rsi.calls.length, 1);
  assert.deepEqual((await OH.getOrderHistory(ME)).items, []);
});

test('after that: a scan reads from page 1 and stops at an order already kept', async () => {
  await OH.setOrderHistory(true);
  await read(fakeRsi({ count: 250 }));
  const rsi = fakeRsi({ count: 254 });
  const r = await read(rsi);
  assert.equal(r.did, 'daily');
  assert.equal(r.n, 4);
  assert.deepEqual(
    rsi.calls.map((c) => c.page),
    [1],
    'about one request',
  );
  const kept = await OH.getOrderHistory(ME);
  assert.equal(kept.items.length, 254);
  assert.equal(kept.items[0].id, 'TESTORDER0254');
});

test('more new orders than a scan reads: nothing kept, every page again on the next scan', async () => {
  await OH.setOrderHistory(true);
  await read(fakeRsi({ count: 10 }));
  const r = await read(fakeRsi({ count: 500 }));
  assert.equal(r.error, 'too-many');
  assert.equal((await OH.getOrderHistory(ME)).items.length, 10, 'the kept orders stay');
  // Auto Scan Daily never reads every page.
  const auto = await read(fakeRsi({ count: 500 }), { dailyOnly: true });
  assert.equal(auto.did, 'none');
  const again = await read(fakeRsi({ count: 500 }));
  assert.equal(again.did, 'full');
  assert.equal((await OH.getOrderHistory(ME)).items.length, 500);
});

test('a stopped read goes on from the next page and keeps nothing until whole', async () => {
  await OH.setOrderHistory(true);
  const first = await read(fakeRsi({ count: 250, fail: ({ page }) => (page === 3 ? 429 : null) }));
  assert.equal(first.did, 'resume-later');
  assert.equal(first.error, 'busy');
  assert.equal(store.orderHistory, undefined, 'nothing half read is kept');
  assert.equal(store.orderHistoryLoad.next, 3);
  assert.equal(store.orderHistoryLoad.items.length, 200);
  delete store.netDown; // RSI's busy answer holds every read off for a while
  const rsi = fakeRsi({ count: 250 });
  const second = await read(rsi);
  assert.equal(second.did, 'full');
  assert.deepEqual(
    rsi.calls.map((c) => c.page),
    [3],
  );
  assert.equal((await OH.getOrderHistory(ME)).items.length, 250);
});

test('RSI says no, a sign-in page or cards that do not read: the read stops, nothing kept', async () => {
  await OH.setOrderHistory(true);
  for (const [rsi, error] of [
    [fakeRsi({ count: 5, fail: () => 403 }), 'refused'],
    [fakeRsi({ count: 5, fail: () => 503 }), 'busy'],
    [fakeRsi({ html: () => '<ul class="orders-item"><li><p>odd</p></li></ul>' }), 'changed'],
    [fakeRsi({ html: () => '<form><input name="password"></form>' }), 'signed-out'],
  ]) {
    delete store.netDown;
    const r = await read(rsi);
    assert.equal(r.ok, false);
    assert.equal(r.error, error);
    assert.equal(rsi.calls.length, 1, 'no retry');
    assert.equal(store.orderHistory, undefined);
  }
  const out = await OH.readOrderHistory({ account: { loggedIn: false }, fetchFn: fetch });
  assert.equal(out.error, 'signed-out');
});

test("the status file's sources.orders pauses it", async () => {
  await OH.setOrderHistory(true);
  const was = OH.sourcePaused;
  OH.sourcePaused = async (id) => (id === 'orders' ? 'paused' : '');
  try {
    const rsi = fakeRsi({ count: 5 });
    assert.equal((await read(rsi)).did, 'paused');
    assert.equal(rsi.calls.length, 0);
  } finally {
    OH.sourcePaused = was;
  }
});

test('off: the reads and the sending stop, the orders read stay until Clear Data', async () => {
  await OH.setOrderHistory(true);
  await read(fakeRsi({ count: 5 }));
  await OH.setOrderHistory(false);
  const rsi = fakeRsi({ count: 6 });
  assert.equal((await read(rsi)).did, 'off');
  assert.equal(rsi.calls.length, 0);
  assert.equal(await OH.getOrderHistory(ME), null, 'so sync sends none');
  assert.equal((await OH.getOrderHistory(ME, { any: true })).items.length, 5, 'still here');
  // On again: the first scan after reads every page again.
  await OH.setOrderHistory(true);
  const again = fakeRsi({ count: 6 });
  assert.equal((await read(again)).did, 'full');
  assert.equal((await OH.getOrderHistory(ME)).items.length, 6);
  // Clear Data takes the orders and the switch.
  await OH.clearData();
  assert.equal(store.orderHistory, undefined);
  assert.equal(store.orderHistoryOn, undefined);
});

test('turned off partway through a read: nothing kept', async () => {
  await OH.setOrderHistory(true);
  let n = 0;
  const r = await read(fakeRsi({ count: 250 }), {
    pause: async () => {
      if (++n === 1) await OH.setOrderHistory(false);
    },
  });
  assert.equal(r.did, 'none');
  assert.equal(store.orderHistory, undefined);
  assert.equal(store.orderHistoryLoad, undefined);
});

test("another account's orders are not this one's", async () => {
  await OH.setOrderHistory(true);
  await read(fakeRsi({ count: 5 }));
  assert.equal(await OH.getOrderHistory({ loggedIn: true, nickname: 'OtherPilot' }), null);
});

test('what sync sends: sources.orders with only the keys the sync format allows', async () => {
  await OH.setOrderHistory(true);
  await read(fakeRsi({ html: () => SAMPLE }));
  const kept = await OH.getOrderHistory(ME);
  // Anything else stored on an order or a line never rides along.
  kept.items[0].billTo = 'Test Billing Street';
  kept.items[0].lines[0].processor = 'Test';
  const db = { sources: {}, history: [] };
  const out = SHAPE.exportPayload({ db, account: ME, orders: kept, now: 0 });
  assert.equal(out.sources.orders.items.length, kept.items.length);
  assert.equal(out.sources.orders.scannedAt, kept.at);
  // The sample's pager links to page 2; asked for it, RSI serves page 1 again: the end.
  assert.deepEqual(out.sources.orders.meta, { pages: 2, complete: true });
  assert.equal('billTo' in out.sources.orders.items[0], false);
  assert.equal('processor' in out.sources.orders.items[0].lines[0], false);
  assert.doesNotMatch(JSON.stringify(out.sources.orders), /Billing|Processor/i);
  // The sync's own schema takes it, as a sync would send it.
  const vector = require('./fixtures/sync-schema/52-valid-orders.json');
  const payload = structuredClone(vector.payload);
  payload.sources.orders = out.sources.orders;
  assert.equal(validate(SCHEMA, payload), null);
  // None kept (off, or never read): no sources.orders at all.
  assert.equal('orders' in SHAPE.exportPayload({ db, account: ME, now: 0 }).sources, false);
  // And the hangar page's hangar leaves it out.
  assert.equal('orders' in SHAPE.hangarView(out).sources, false);
});
