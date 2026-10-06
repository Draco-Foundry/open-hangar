'use strict';

/* Home "Layout B, Final": Customize Home's layouts (ui/lib/home-layout.js), Wishlist
   Watch rows (ui/lib/wish-watch.js) and the top bar's Game Status feed
   (ui/lib/game-status.js). Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

const layoutLib = () => import('../ui/lib/home-layout.js');
const wishLib = () => import('../ui/lib/wish-watch.js');
const gsLib = () => import('../ui/lib/game-status.js');

// --- Customize Home -------------------------------------------------------------

test('default layout: the five Layout B cards on, Spotlight and Referrals off, Citizen pinned', async () => {
  const { defaultCards, normalizeCards } = await layoutLib();
  const d = defaultCards();
  assert.deepEqual(
    Object.keys(d).filter((k) => d[k]),
    ['citizen', 'value', 'acquisitions', 'wishlist', 'quicklinks'],
  );
  assert.equal(normalizeCards({ citizen: false, value: false, bogus: true }).citizen, true);
  assert.equal(normalizeCards({ value: false }).value, false);
  assert.ok(!('bogus' in normalizeCards({ bogus: true })));
});

test('the old Quick Links switch moves over only when nothing newer was saved', async () => {
  const { normalizePref } = await layoutLib();
  assert.equal(normalizePref(null, true).cards.quicklinks, false);
  assert.equal(normalizePref(null, false).cards.quicklinks, true);
  assert.equal(normalizePref({ cards: { quicklinks: true } }, true).cards.quicklinks, true);
});

test('save: named, no duplicates (any case, Default taken), 24 characters, ten at most', async () => {
  const { normalizePref, saveLayout, MAX_SAVED } = await layoutLib();
  let pref = normalizePref(null);
  assert.equal(saveLayout(pref, '   ').ok, false);
  assert.equal(saveLayout(pref, 'default').ok, false);
  let r = saveLayout(pref, '  Trader\u0007   Mode  ');
  assert.ok(r.ok);
  pref = r.pref;
  assert.equal(pref.saved[0].name, 'Trader Mode');
  assert.equal(pref.saved[0].v, 1);
  assert.equal(saveLayout(pref, 'TRADER MODE').ok, false);
  assert.equal(saveLayout(pref, 'x'.repeat(40)).pref.saved[1].name.length, 24);
  for (let i = pref.saved.length; i < MAX_SAVED; i++) pref = saveLayout(pref, `L${i}`).pref;
  assert.equal(pref.saved.length, 10);
  const full = saveLayout(pref, 'One More');
  assert.equal(full.ok, false);
  assert.match(full.error, /limit/);
  // Saved copies are clean even from a messy store.
  const messy = normalizePref({ saved: [...pref.saved, { name: 'Extra' }, { name: 'L1' }, null] });
  assert.equal(messy.saved.length, 10);
});

test('apply and delete a saved layout; Default always applies and never deletes', async () => {
  const { normalizePref, saveLayout, applyLayout, deleteLayout, currentLayoutName } =
    await layoutLib();
  let pref = normalizePref(null);
  assert.equal(currentLayoutName(pref), 'Default');
  pref = { ...pref, cards: { ...pref.cards, wishlist: false, spotlight: true } };
  assert.equal(currentLayoutName(pref), '');
  pref = saveLayout(pref, 'Pictures').pref;
  assert.equal(currentLayoutName(pref), 'Pictures');
  pref = applyLayout(pref, 'Default');
  assert.equal(pref.cards.wishlist, true);
  assert.equal(pref.cards.spotlight, false);
  pref = applyLayout(pref, 'Pictures');
  assert.equal(pref.cards.spotlight, true);
  assert.equal(applyLayout(pref, 'Nope'), pref);
  pref = deleteLayout(pref, 'Pictures');
  assert.equal(pref.saved.length, 0);
});

test('rows end level: the last card in a row takes the spare columns', async () => {
  const { flowSpans, HOME_CARDS } = await layoutLib();
  const pick = (...ids) => ids.map((id) => HOME_CARDS.find((c) => c.id === id));
  // Default, wide: 4 + 4 + 4, then Quick Links 12.
  assert.deepEqual(flowSpans(pick('value', 'acquisitions', 'wishlist', 'quicklinks')), {
    value: 4,
    acquisitions: 4,
    wishlist: 4,
    quicklinks: 12,
  });
  // About 1100px: 6 + 6, Wishlist Watch alone takes the whole row.
  assert.deepEqual(flowSpans(pick('value', 'acquisitions', 'wishlist', 'quicklinks'), 'mid'), {
    value: 6,
    acquisitions: 6,
    wishlist: 12,
    quicklinks: 12,
  });
  // One hidden: the two left share the row.
  assert.deepEqual(flowSpans(pick('value', 'wishlist', 'quicklinks')), {
    value: 4,
    wishlist: 8,
    quicklinks: 12,
  });
  // Spotlight added: a second row of one stretches.
  assert.deepEqual(flowSpans(pick('value', 'acquisitions', 'wishlist', 'spotlight')), {
    value: 4,
    acquisitions: 4,
    wishlist: 4,
    spotlight: 12,
  });
});

// --- Wishlist Watch ---------------------------------------------------------------

test('wish rows: generic kinds, Buy only when in the store, Warbond only when cheaper', async () => {
  const { wishRow, wishSummary } = await wishLib();
  const url = 'https://robertsspaceindustries.com/pledge/ships/x/y';
  const on = wishRow({
    kind: 'ship',
    name: 'Cutlass Black',
    price: 110,
    warbond: 100,
    status: 'in',
    url,
  });
  assert.equal(on.buyable, true);
  assert.equal(on.warbond, 100);
  assert.equal(on.statusLabel, 'In Store Now');
  const off = wishRow({ kind: 'ship', name: 'Pioneer', price: 850, status: 'out', url });
  assert.equal(off.buyable, false, 'never a Buy button when not for sale');
  assert.equal(off.statusLabel, 'Not on Sale');
  assert.equal(wishRow({ name: 'X', status: 'soldout', url }).buyable, false);
  assert.equal(wishRow({ name: 'X', status: 'pack', url }).buyable, false);
  assert.equal(wishRow({ name: 'X', price: 50, warbond: 60, status: 'in', url }).warbond, null);
  assert.equal(wishRow({ name: 'X', status: 'in', url: 'https://evil.example/' }).buyable, false);
  const ccu = wishRow({
    kind: 'ccu',
    from: 'Avenger Titan',
    to: 'Cutlass Black',
    price: 20,
    status: 'in',
    url,
  });
  assert.equal(ccu.kindLabel, 'CCU');
  assert.equal(ccu.name, 'Avenger Titan to Cutlass Black');
  assert.equal(wishRow({ kind: 'weird', name: 'Y' }).kind, 'ship');
  assert.equal(wishRow({ name: 'Y' }).status, 'unknown');
  assert.deepEqual(wishSummary([on, off, ccu]), { on: 2, total: 3 });
});

test('checkedAgo reads like a person', async () => {
  const { checkedAgo } = await wishLib();
  const now = Date.UTC(2026, 9, 6, 12);
  assert.equal(checkedAgo(now - 20e3, now), 'just now');
  assert.equal(checkedAgo(now - 60e3, now), '1 minute ago');
  assert.equal(checkedAgo(now - 2 * 3600e3, now), '2 hours ago');
  assert.equal(checkedAgo(now - 30 * 3600e3, now), 'yesterday');
  assert.equal(checkedAgo(now - 2 * 864e5, now), '2 days ago');
});

// --- Game Status feed -------------------------------------------------------------

const FEED = {
  v: 1,
  updatedAt: '2026-10-06T08:08:31.345Z',
  status: { level: 'ok', label: 'All Systems Go', url: 'https://openhangar.space/' },
  live: { version: '4.10.1', released: '2026-09-16T00:00:00.000Z' },
  ptu: { version: '4.10.2', wave: null, notesAt: '2026-10-05T17:55:19.000Z' },
  patchNotes: {
    title: 'Alpha 4.10.2 PTU Patch Notes',
    url: 'https://robertsspaceindustries.com/spectrum/community/SC/forum/190048/thread/x',
    at: '2026-10-05T17:55:19.000Z',
  },
  event: {
    name: 'Some Event',
    start: '2026-09-21T00:00:00.000Z',
    end: '2026-10-08T00:00:00.000Z',
    url: null,
  },
  nextEvent: null,
};

test('shapeGameStatus reads v1, drops what it cannot trust', async () => {
  const { shapeGameStatus, pillOf } = await gsLib();
  const g = shapeGameStatus(FEED);
  assert.equal(g.live.version, '4.10.1');
  assert.equal(g.live.released, Date.UTC(2026, 8, 16));
  assert.equal(g.ptu.wave, null);
  assert.equal(g.event.end, Date.UTC(2026, 9, 8));
  assert.deepEqual(pillOf(g), { text: 'LIVE 4.10.1', dot: 'ok' });
  assert.equal(shapeGameStatus({ ...FEED, v: 2 }), null);
  assert.equal(shapeGameStatus(null), null);
  // Unknown status: the LIVE version with a neutral dot.
  assert.deepEqual(pillOf(shapeGameStatus({ ...FEED, status: null })), {
    text: 'LIVE 4.10.1',
    dot: 'none',
  });
  assert.equal(shapeGameStatus({ ...FEED, status: { level: 'meh' } }).status, null);
  assert.equal(
    shapeGameStatus({ ...FEED, patchNotes: { ...FEED.patchNotes, url: 'javascript:alert(1)' } })
      .patchNotes,
    null,
  );
  // Never loaded: neutral.
  assert.deepEqual(pillOf(null), { text: 'Game Status', dot: 'none' });
});

test('loadGameStatus: at most every 10 minutes, the last copy when the site is quiet', async () => {
  const { loadGameStatus, GAME_STATUS_URL } = await gsLib();
  assert.equal(GAME_STATUS_URL, 'https://openhangar.space/api/game-status');
  const mem = {};
  const store = {
    get: async (k) => (k in mem ? { [k]: structuredClone(mem[k]) } : {}),
    set: async (o) => Object.assign(mem, structuredClone(o)),
  };
  let calls = 0;
  let answer = () => Response.json(FEED);
  const fetchFn = async (url, init) => {
    calls++;
    assert.equal(init.credentials, 'omit');
    return answer();
  };
  const t0 = Date.UTC(2026, 9, 6, 12);
  const a = await loadGameStatus({ fetchFn, store, guarded: null, now: t0 });
  assert.equal(a.live.version, '4.10.1');
  assert.equal(calls, 1);
  await loadGameStatus({ fetchFn, store, guarded: null, now: t0 + 9 * 60e3 });
  assert.equal(calls, 1, 'cached for 10 minutes');
  answer = () => new Response('', { status: 503 });
  const b = await loadGameStatus({ fetchFn, store, guarded: null, now: t0 + 11 * 60e3 });
  assert.equal(calls, 2);
  assert.equal(b.live.version, '4.10.1', 'the last good copy');
  await loadGameStatus({ fetchFn, store, guarded: null, now: t0 + 12 * 60e3 });
  assert.equal(calls, 2, 'a failed ask counts too: no hammering');
  answer = () => {
    throw new Error('offline');
  };
  const empty = await loadGameStatus({
    fetchFn,
    store: { get: async () => ({}), set: async () => {} },
    guarded: null,
    now: t0,
  });
  assert.equal(empty, null);
});
