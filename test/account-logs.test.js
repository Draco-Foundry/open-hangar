'use strict';
// RSI Account Logs (the accountLogs build flag): the pledge log and store credit log
// parsers on invented pages in RSI's shape (test/fixtures/pledge-log.sample.html,
// credit-log.sample.html: no real data), with no handle or email ever coming out; the
// merge (each line once, newest first, a claimed gift yours or received); the reader
// (the Rsi-Token header, {page:N}, a full history only on request, paced, resumable, kept
// only when whole; the day's read stopping at a known line; each log's pause switch);
// and what sync sends: only the keys the sync format allows. Run: `npm test`.
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
const P = globalThis.OpenHangar;
const OH = globalThis.OH;
const SHAPE = require('../src/hangar-shape.js');
const SCHEMA = require('../src/sync-schema.js');
const { validate } = require('../src/schema-check.js');
const RULES = globalThis.OHRules;

const fixture = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
// The gift's recipient, an invented email put in here: no fixture may hold one.
const PLEDGE_PAGE = fixture('pledge-log.sample.html').replace(
  '{recipient}',
  ['someone', 'example.invalid'].join('@'),
);
const CREDIT_PAGE = fixture('credit-log.sample.html');
// Who the invented lines name: none of it may come out.
const PEOPLE = /ExamplePilot|OldExampleName|OtherPilot42|someone|example\.invalid|@/;

const ME = { loggedIn: true, nickname: 'TestPilot' };
const noPause = () => Promise.resolve();
let paused = {};
OH.sourcePaused = async (id) => paused[id] || '';
test.beforeEach(() => {
  store = {};
  paused = {};
});

test('the pledge log: each event, its time in UTC, nobody named', () => {
  const { events, unread } = P.parsePledgeLog(PLEDGE_PAGE);
  assert.equal(unread, 1, 'the line with no pledge');
  assert.deepEqual(events, [
    {
      at: '2026-10-30T22:12:00Z',
      pledge: '90000001',
      name: 'Standalone Ship - Example Hauler',
      kind: 'bought',
      order: 'EXAMPLE0001',
      value: 123450,
    },
    {
      at: '2026-10-29T09:00:00Z',
      pledge: '90000002',
      name: 'Standalone Ships - Example Scout',
      kind: 'buyBackCreated',
      order: 'EXAMPLE0002',
      value: null,
    },
    {
      at: '2026-10-29T09:00:00Z',
      pledge: '90000000',
      name: 'Standalone Ships - Example Scout',
      kind: 'boughtBack',
      order: 'EXAMPLE0002',
      value: null,
    },
    {
      at: '2026-10-28T20:15:00Z',
      pledge: '90000003',
      name: "Package - Example Starter 'Deluxe'",
      kind: 'melted',
      order: null,
      value: 4500,
    },
    {
      at: '2026-10-27T12:30:00Z',
      pledge: '90000004',
      name: 'Standalone Ship - Example Gift',
      kind: 'giftClaimed',
      order: null,
      value: 6000,
    },
    {
      at: '2026-10-27T12:00:00Z',
      pledge: '90000004',
      name: 'Standalone Ship - Example Gift',
      kind: 'giftSent',
      order: null,
      value: 6000,
    },
    {
      at: '2026-10-26T00:05:00Z',
      pledge: '90000005',
      name: 'Standalone Ship - Example Present',
      kind: 'giftClaimed',
      order: null,
      value: 3000,
    },
    {
      at: '2026-10-25T18:00:00Z',
      pledge: '90000006',
      name: 'Example Flair',
      kind: 'granted',
      order: null,
      value: null,
    },
    {
      at: '2026-10-04T15:04:00Z',
      pledge: '90000007',
      name: 'Add-Ons - Example Paint',
      kind: 'bought',
      order: 'EXAMPLE0007',
      value: 0,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(events), PEOPLE);
});

test('a line with "by" the rules do not know is other, and keeps no words of its own', () => {
  const page = `<div class="pledge-log-entry"><p>Jan 2, 2020, 1:02 pm - <span class="important">X</span> #1 - Moved by ExamplePilot to somewhere</p></div>`;
  const { events } = P.parsePledgeLog(page);
  assert.equal(events[0].kind, 'other');
  assert.doesNotMatch(JSON.stringify(events), PEOPLE);
});

test('the store credit log: in and out, melts and orders, amounts in cents', () => {
  const { lines, unread } = P.parseCreditLog(CREDIT_PAGE);
  assert.equal(unread, 1);
  assert.deepEqual(lines, [
    {
      at: '2026-10-30T22:12:00Z',
      dir: 'out',
      amount: 123450,
      kind: 'order',
      pledge: null,
      name: null,
      order: 'EXAMPLE0001',
    },
    {
      at: '2026-10-28T20:15:00Z',
      dir: 'in',
      amount: 4500,
      kind: 'melt',
      pledge: '90000003',
      name: "Package - Example Starter 'Deluxe'",
      order: null,
    },
    {
      at: '2026-10-20T13:00:00Z',
      dir: 'in',
      amount: 500,
      kind: 'other',
      pledge: null,
      name: null,
      order: null,
    },
  ]);
});

test('log times: 12-hour and 24-hour clocks, seconds, and impossible days refused', () => {
  // RSI's own form (the owner's log, 2026-11-01): a zero-padded day, no comma after it.
  assert.equal(P.parseLogTime('Nov 01 2026, 3:18 am -'), '2026-11-01T03:18:00Z');
  assert.equal(P.parseLogTime('Oct 30, 2026, 12:00 am -'), '2026-10-30T00:00:00Z');
  assert.equal(P.parseLogTime('Oct 30, 2026, 12:00 pm -'), '2026-10-30T12:00:00Z');
  assert.equal(P.parseLogTime('October 3 2017, 23:59:58'), '2017-10-03T23:59:58Z');
  assert.equal(P.parseLogTime('Sept. 3, 2019, 7:05 P.M.'), '2019-09-03T19:05:00Z');
  assert.equal(P.parseLogTime('Feb 30, 2026, 1:00 pm'), null);
  assert.equal(P.parseLogTime('Oct 30, 2026, 13:00 pm'), null);
  assert.equal(P.parseLogTime('yesterday'), null);
});

test('the merge: each line once, newest first, a claimed gift yours or received', () => {
  const { events } = P.parsePledgeLog(PLEDGE_PAGE);
  const merged = OH.mergeAccountLog('pledge', events.slice(4), events);
  assert.equal(merged.length, events.length);
  assert.deepEqual(
    merged.map((e) => e.at),
    [...merged.map((e) => e.at)].sort().reverse(),
  );
  const kinds = Object.fromEntries(
    merged.filter((e) => /^gift/.test(e.kind)).map((e) => [`${e.pledge}:${e.kind}`, 1]),
  );
  // #90000004 went out from this account as a gift: its claim is the recipient's. #90000005
  // never did: it was a gift to this account.
  assert.deepEqual(Object.keys(kinds).sort(), [
    '90000004:giftClaimed',
    '90000004:giftSent',
    '90000005:giftReceived',
  ]);
  // Merging again changes nothing (a received gift keys as a claim).
  assert.deepEqual(OH.mergeAccountLog('pledge', merged, events), merged);
});

// A fake RSI: `pages` per log, each a list of rendered pages; `fail` → a status for a call.
function fakeRsi({ pledge = [], credit = [], fail = () => null } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const log = url.endsWith(RULES.accountLogs.pledgeLog) ? 'pledge' : 'credit';
    const { page } = JSON.parse(init.body);
    calls.push({ log, page, headers: init.headers, credentials: init.credentials });
    const status = fail({ log, page, n: calls.length });
    if (status) return new Response('', { status });
    const pages = log === 'pledge' ? pledge : credit;
    const data = pages.length
      ? { rendered: pages[page - 1] || '', page, pagecount: pages.length }
      : { rendered: '' };
    return Response.json({ success: 1, code: 'OK', msg: 'OK', data });
  };
  return { fetchFn, calls };
}
// An invented pledge log line.
const line = (n, kind = 'Created by ExamplePilot - order #ORD' + n + ', value: $1.00 USD') => {
  const minute = String(n % 60).padStart(2, '0');
  const hour = 1 + (Math.floor(n / 60) % 12);
  const day = 1 + Math.floor(n / 720);
  return `<div class="pledge-log-entry"><p>Jan ${day}, 2025, ${hour}:${minute} am - <span class="important">Example ${n}</span> #${80000000 + n} - ${kind}</p></div>`;
};
// Newest first: page 1 holds the highest numbers.
const pagesOf = (from, to) => {
  const ns = [];
  for (let n = to; n >= from; n--) ns.push(n);
  const out = [];
  for (let i = 0; i < ns.length; i += 25)
    out.push(
      ns
        .slice(i, i + 25)
        .map((n) => line(n))
        .join(''),
    );
  return out;
};
const creditPage = `<div class="pledge-log-entry"><p>Jan 1, 2025, 1:00 am - <ins>$5.00 USD</ins> - Reclaim of pledge #80000001 Example 1</p></div>`;

test('nothing is read before the pilot asks for the full history', async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 30), credit: [creditPage] });
  const r = await OH.readAccountLogs({ account: ME, token: 'tok', fetchFn: rsi.fetchFn });
  assert.deepEqual(r.parts, { pledge: { did: 'none' }, credit: { did: 'none' } });
  assert.equal(rsi.calls.length, 0);
  assert.equal(store.accountLogs, undefined);
});

test('signed out, or no Rsi-Token cookie: nothing is asked', async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 3) });
  await OH.wantAccountLogs(ME);
  const out = await OH.readAccountLogs({ account: { loggedIn: false }, fetchFn: rsi.fetchFn });
  assert.equal(out.error, 'signed-out');
  const none = await OH.readAccountLogs({ account: ME, token: '', fetchFn: rsi.fetchFn });
  assert.equal(none.error, 'signed-out');
  assert.equal(rsi.calls.length, 0);
});

test('the full history: every page, paced, the token and ajax headers, kept when whole', async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 60), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  let pauses = 0;
  const progress = [];
  const r = await OH.readAccountLogs({
    account: ME,
    token: 'tok%2Bvalue',
    fetchFn: rsi.fetchFn,
    pause: async () => void pauses++,
    onProgress: (part, page, pagecount) => progress.push(`${part} ${page}/${pagecount}`),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(
    rsi.calls.map((c) => `${c.log}:${c.page}`),
    ['pledge:1', 'pledge:2', 'pledge:3', 'credit:1'],
  );
  assert.equal(pauses, 3, 'a pause before every request but the first');
  assert.deepEqual(progress, ['pledge 1/3', 'pledge 2/3', 'pledge 3/3', 'credit 1/1']);
  for (const c of rsi.calls) {
    assert.equal(c.headers[RULES.cart.tokenHeader], 'tok%2Bvalue');
    assert.equal(c.headers[RULES.accountLogs.ajaxHeader], RULES.accountLogs.ajaxValue);
    assert.equal(c.credentials, 'include');
  }
  assert.equal(store.accountLogs.pledge.items.length, 60);
  assert.equal(store.accountLogs.pledge.pages, 3);
  assert.equal(store.accountLogs.credit.items.length, 1);
  assert.equal(store.accountLogsLoad, undefined, 'the load is done');
  assert.doesNotMatch(JSON.stringify(store.accountLogs), PEOPLE);
});

test('a stopped load keeps nothing as the log, and goes on from the next page', async () => {
  const pages = pagesOf(1, 75);
  let busy = true;
  const rsi = fakeRsi({
    pledge: pages,
    credit: [creditPage],
    fail: ({ log, page }) => (busy && log === 'pledge' && page === 3 ? 429 : null),
  });
  await OH.wantAccountLogs(ME);
  const first = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: rsi.fetchFn,
    pause: noPause,
  });
  assert.equal(first.ok, false);
  assert.equal(first.parts.pledge.did, 'resume-later');
  assert.equal(first.parts.credit, undefined, 'RSI said to wait: the credit log waits too');
  assert.equal(store.accountLogs, undefined, 'nothing half read is kept');
  assert.equal(store.accountLogsLoad.next, 3);
  assert.equal(store.accountLogsLoad.items.length, 50);
  busy = false;
  rsi.calls.length = 0;
  // RSI's net-down guard holds a host for a while after a 429: start clean.
  delete store.netDown;
  const second = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: rsi.fetchFn,
    pause: noPause,
  });
  assert.equal(second.ok, true);
  assert.deepEqual(
    rsi.calls.map((c) => `${c.log}:${c.page}`),
    ['pledge:3', 'credit:1'],
  );
  assert.equal(store.accountLogs.pledge.items.length, 75);
});

test("the day's read: page 1 until a line already kept, then merged", async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 60), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn, pause: noPause });
  // Ten new lines since: page 1 holds them and fifteen known ones.
  const later = fakeRsi({ pledge: pagesOf(1, 70), credit: [creditPage] });
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: later.fetchFn,
    pause: noPause,
  });
  assert.deepEqual(r.parts.pledge, { did: 'daily', n: 10 });
  assert.deepEqual(r.parts.credit, { did: 'daily', n: 0 });
  assert.deepEqual(
    later.calls.map((c) => `${c.log}:${c.page}`),
    ['pledge:1', 'credit:1'],
  );
  assert.equal(store.accountLogs.pledge.items.length, 70);
  assert.equal(store.accountLogs.pledge.items[0].pledge, '80000070');
});

test("more new lines than a day's read: nothing kept, the full history asked for again", async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 10), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn, pause: noPause });
  const flood = fakeRsi({ pledge: pagesOf(1, 500), credit: [creditPage] });
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: flood.fetchFn,
    pause: noPause,
  });
  assert.equal(r.parts.pledge.error, 'too-many');
  assert.equal(flood.calls.filter((c) => c.log === 'pledge').length, 8);
  assert.equal(store.accountLogs.pledge.items.length, 10, 'the kept log is as it was');
  assert.equal(store.accountLogsLoad.want, true);
});

test("the pilot's off switch: the logs go, nothing more is read, a read under way keeps nothing", async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 10), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn, pause: noPause });
  assert.equal(store.accountLogs.pledge.items.length, 10);
  await OH.stopAccountLogs();
  assert.equal(store.accountLogs, undefined);
  const off = await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn });
  assert.deepEqual(off.parts, { pledge: { did: 'none' }, credit: { did: 'none' } });
  assert.equal(await OH.getAccountLogs(ME), null, 'so sync sends none');
  // Turned off halfway through a full load: nothing is kept.
  await OH.wantAccountLogs(ME);
  const slow = fakeRsi({ pledge: pagesOf(1, 60), credit: [creditPage] });
  let n = 0;
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: slow.fetchFn,
    pause: async () => {
      if (++n === 2) await OH.stopAccountLogs();
    },
  });
  assert.equal(r.parts.pledge.did, 'none');
  assert.equal(store.accountLogs, undefined);
  assert.equal(store.accountLogsLoad, undefined);
});

test('each log has its own pause switch', async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 5), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  paused = { pledgeLog: 'paused' };
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: rsi.fetchFn,
    pause: noPause,
  });
  assert.deepEqual(r.parts.pledge, { did: 'paused' });
  assert.equal(r.parts.credit.did, 'full');
  assert.deepEqual(
    rsi.calls.map((c) => c.log),
    ['credit'],
  );
  assert.equal(store.accountLogs.pledge, undefined);
});

test('a page whose lines none read: RSI changed it, nothing kept', async () => {
  const odd = '<div class="pledge-log-entry"><p>Something new</p></div>'.repeat(25);
  const rsi = fakeRsi({ pledge: [odd], credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: rsi.fetchFn,
    pause: noPause,
  });
  assert.equal(r.parts.pledge.error, 'changed');
  assert.equal(store.accountLogs?.pledge, undefined);
});

test("an empty log (no page or pagecount in RSI's answer) is a whole, empty read", async () => {
  const rsi = fakeRsi({ pledge: [], credit: [] });
  await OH.wantAccountLogs(ME);
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: rsi.fetchFn,
    pause: noPause,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(store.accountLogs.pledge.items, []);
  assert.equal(store.accountLogs.pledge.pages, 0);
});

test("another account's logs are never read back", async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 3), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn, pause: noPause });
  assert.ok(await OH.getAccountLogs(ME));
  assert.equal(await OH.getAccountLogs({ loggedIn: true, nickname: 'SomeoneElse' }), null);
});

test('what sync sends: only the allowed keys, valid against the schema, apart from the hangar', async () => {
  const rsi = fakeRsi({ pledge: [PLEDGE_PAGE], credit: [CREDIT_PAGE] });
  await OH.wantAccountLogs(ME);
  await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn, pause: noPause });
  // Something extra stored next to a line never rides along.
  store.accountLogs.pledge.items[0].handle = 'ExamplePilot';
  store.accountLogs.credit.items[0].email = ['someone', 'example.invalid'].join('@');
  const payload = SHAPE.exportPayload({
    db: { sources: {}, history: [] },
    account: { handle: 'TestPilot' },
    accountLogs: store.accountLogs,
    appVersion: '0.5.8',
    now: 0,
  });
  assert.equal(payload.sources.pledgeLog.items.length, 9);
  assert.equal(payload.sources.creditLog.items.length, 3);
  assert.deepEqual(payload.sources.pledgeLog.meta, { pages: 1, unread: 1 });
  assert.doesNotMatch(
    JSON.stringify([payload.sources.pledgeLog, payload.sources.creditLog]),
    PEOPLE,
  );
  assert.equal(validate(SCHEMA, payload), null);
  // The website keeps them apart from the hangar: the hangar view has neither.
  const view = SHAPE.hangarView(payload);
  assert.ok(!('pledgeLog' in view.sources) && !('creditLog' in view.sources));
  // A log not read yet isn't sent.
  const none = SHAPE.exportPayload({ db: { sources: {} }, accountLogs: null, now: 0 });
  assert.ok(!('pledgeLog' in none.sources));
});

test('the sync schema refuses an email, a handle or a payment field on a log line', () => {
  const base = SHAPE.exportPayload({
    db: { sources: {} },
    account: { handle: 'TestPilot' },
    accountLogs: {
      pledge: { items: [{ at: '2026-10-30T22:12:00Z', pledge: '1', kind: 'giftSent' }], at: 1 },
      credit: {
        items: [{ at: '2026-10-30T22:12:00Z', dir: 'out', amount: 1, kind: 'order' }],
        at: 1,
      },
    },
    now: 0,
  });
  assert.equal(validate(SCHEMA, base), null);
  for (const [src, key] of [
    ['pledgeLog', 'email'],
    ['pledgeLog', 'handle'],
    ['pledgeLog', 'recipient'],
    ['creditLog', 'paymentMethod'],
    ['creditLog', 'card'],
  ]) {
    const p = structuredClone(base);
    p.sources[src].items[0][key] = 'x';
    assert.ok(validate(SCHEMA, p), `${src} ${key} refused`);
  }
  const odd = structuredClone(base);
  odd.sources.pledgeLog.items[0].at = 'Oct 30, 2026';
  assert.ok(validate(SCHEMA, odd), 'a time not in UTC ISO form is refused');
});

// Auto Scan Daily (ui/scan/runner.js autoScan, `dailyOnly`): only the newest lines, never
// the full history, which waits for a scan the pilot starts (the privacy policy's Auto
// Scan Daily section).
test('dailyOnly: the full history waits; once it is in, only the newest lines', async () => {
  const rsi = fakeRsi({ pledge: pagesOf(1, 60), credit: [creditPage] });
  await OH.wantAccountLogs(ME);
  const held = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: rsi.fetchFn,
    pause: noPause,
    dailyOnly: true,
  });
  assert.deepEqual(held.parts, { pledge: { did: 'none' }, credit: { did: 'none' } });
  assert.equal(rsi.calls.length, 0, 'nothing read');
  assert.ok(store.accountLogsLoad, 'the full history still wanted');
  await OH.readAccountLogs({ account: ME, token: 't', fetchFn: rsi.fetchFn, pause: noPause });
  const later = fakeRsi({ pledge: pagesOf(1, 70), credit: [creditPage] });
  const r = await OH.readAccountLogs({
    account: ME,
    token: 't',
    fetchFn: later.fetchFn,
    pause: noPause,
    dailyOnly: true,
  });
  assert.deepEqual(r.parts.pledge, { did: 'daily', n: 10 });
  assert.deepEqual(
    later.calls.map((c) => `${c.log}:${c.page}`),
    ['pledge:1', 'credit:1'],
  );
});
