'use strict';
// Extension Alerts (src/alerts.js): the public sale feed matched on the device against
// this browser's scan and the account's Wishlist keys, what the pilot has seen, the
// notifications and the badge, and a check that asks politely and sends nothing of the
// pilot's. The feed is invented in the website's v1 shape (open-hangar-server
// lib/sale-feed.ts), names as RSI writes them; the hangar and buy-backs are invented
// too. No request leaves the test. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const AL = require('../src/alerts.js');

const NOW = Date.UTC(2026, 9, 11, 12, 0);
const MIN = 60e3;
const HOUR = 3600e3;

// The website's feed (v1), as /api/store/on-sale answers.
const FEED = {
  v: 1,
  updatedAt: '2026-10-11T11:55:00.000Z',
  ships: [
    {
      slug: 'sabre-raven-ex',
      name: 'Sabre Raven EX',
      keys: ['aegis sabre raven ex', 'aegs sabre raven ex', 'sabre raven ex'],
    },
    {
      slug: 'cutlass-black',
      name: 'Cutlass Black',
      keys: ['cutlass black', 'drak cutlass black', 'drake cutlass black'],
    },
    { slug: 'cutlass-red', name: 'Cutlass Red', keys: ['cutlass red', 'drake cutlass red'] },
    {
      slug: 'misc-freelancer-max',
      name: 'MISC Freelancer MAX',
      keys: ['freelancer max', 'misc freelancer max', 'musashi freelancer max'],
    },
    {
      slug: 'constellation-andromeda',
      name: 'Constellation Andromeda',
      keys: ['constellation andromeda', 'rsi constellation andromeda'],
    },
    { slug: 'raptor', name: 'Raptor', keys: ['misc raptor', 'raptor'] },
  ],
  items: [
    {
      id: 'sku-19700',
      kind: 'ship',
      name: 'Sabre Raven EX',
      price: 185,
      sale: ['limited'],
      limitedSince: '2026-10-08T12:00:00.000Z',
      arrivedAt: null,
      endsOn: '2026-10-15',
      ships: ['sabre-raven-ex'],
    },
    {
      id: 'sku-19701',
      kind: 'ship',
      name: 'Sabre Raven EX',
      price: 165,
      sale: ['warbond', 'limited'],
      endsOn: null,
      ships: ['sabre-raven-ex'],
    },
    {
      id: 'sku-10',
      kind: 'ship',
      name: 'Cutlass Black',
      price: 110,
      sale: [],
      ships: ['cutlass-black'],
    },
    {
      id: 'sku-11',
      kind: 'ship',
      name: 'Freelancer MAX',
      price: 150,
      sale: ['warbond'],
      ships: ['misc-freelancer-max'],
    },
    {
      id: 'sku-20',
      kind: 'paint',
      name: 'Cutlass - Coalfire Paint',
      price: 15,
      sale: ['listed'],
      ships: ['cutlass-black', 'cutlass-red'],
    },
    {
      id: 'sku-21',
      kind: 'paint',
      name: 'Cutlass - Old Paint',
      price: 15,
      sale: [],
      ships: ['cutlass-black', 'cutlass-red'],
    },
    {
      id: 'sku-22',
      kind: 'paint',
      name: 'Cutlass - Akuma Paint',
      price: 15,
      sale: ['back'],
      ships: ['cutlass-red'],
    },
    {
      id: 'sku-30',
      kind: 'gear',
      name: 'Virgil Tailwind Flight Suit',
      price: 8,
      sale: [],
      ships: [],
    },
    {
      id: 'upgrade-341',
      kind: 'upgrade',
      name: 'Upgrade to Sabre Raven EX',
      price: 185,
      sale: ['warbond'],
      ships: ['sabre-raven-ex'],
    },
  ],
};
const ship = (label) => ({ kind: 'Ship', label });
const DB = {
  schemaVersion: 3,
  sources: {
    hangar: {
      scannedAt: NOW - HOUR,
      items: [
        // A ship you own, as RSI's hangar names it.
        { id: '1', name: 'Standalone Ship - Cutlass Black', contents: [ship('Cutlass Black')] },
        // A paint you own already: never an alert for it.
        {
          id: '2',
          name: 'Paints - Cutlass - Akuma Paint',
          isPaint: true,
          contents: [{ kind: 'Skin', label: 'Cutlass - Akuma Paint' }],
        },
        // The Wiki's "MISC" in front is the feed's spelling too.
        { id: '3', name: 'Package - Freelancer MAX', contents: [ship('MISC Freelancer MAX')] },
        // An upgrade pledge owns no ship.
        {
          id: '4',
          name: 'Upgrade - Arrow to Sabre Raven EX',
          isCCU: true,
          ccu: { from: 'Arrow', to: 'Sabre Raven EX' },
          contents: [ship('Sabre Raven EX')],
        },
        // RSI's tag after a dash.
        { id: '5', name: 'Referral', contents: [ship('MISC RAPTOR - Referral Reward')] },
        // A ship the feed doesn't know: no match, never a guess (not the Raven EX).
        { id: '6', name: 'Standalone Ship - Sabre Raven', contents: [ship('Sabre Raven')] },
      ],
    },
    buybacks: {
      scannedAt: NOW - HOUR,
      items: [
        { id: 'b1', name: 'Standalone Ships - Sabre Raven EX - LTI', kind: 'ship' },
        {
          id: 'b2',
          name: 'Constellation Pack',
          kind: 'pack',
          contains: 'Constellation Andromeda and 3 other items',
        },
        {
          id: 'b3',
          name: 'Upgrade - X to Cutlass Black',
          kind: 'ccu',
          isCCU: true,
          ccu: { from: 'X', to: 'Cutlass Black' },
        },
        { id: 'b4', name: 'Cutlass - Coalfire Paint', kind: 'paint' },
      ],
    },
  },
};

test('nameKey: the website folds names the same way (open-hangar-server saleKey)', () => {
  // The same strings and answers are in the website's test/sale-feed.test.ts.
  const cases = [
    ['Cutlass Black', 'cutlass black'],
    ['X1 - FORCE', 'x1 force'],
    ['Krüger P-72 Archimedes', 'kruger p 72 archimedes'],
    ['Virgil Tailwind ‘Kruger’ Flight Suit', 'virgil tailwind kruger flight suit'],
    ['  MISC   Freelancer MAX ', 'misc freelancer max'],
    ["Collector's Edition", 'collectors edition'],
    ['Hull C "Ironclad"', 'hull c ironclad'],
    ['C.O. Mustang Alpha', 'c o mustang alpha'],
    ['600i 2951 BIS', '600i 2951 bis'],
    ['Nox Kue & Gear', 'nox kue gear'],
    ['', ''],
  ];
  for (const [s, k] of cases) assert.equal(AL.nameKey(s), k, s);
});

test("buy-back titles: RSI's label and insurance words off, the ship's own words kept", () => {
  assert.equal(AL.bareShipName('Standalone Ships - Cutlass Black - LTI'), 'Cutlass Black');
  assert.equal(AL.bareShipName('Sabre Raven EX Warbond Edition'), 'Sabre Raven EX');
  assert.equal(AL.bareShipName('Constellation Andromeda - 10 Year'), 'Constellation Andromeda');
  assert.equal(AL.bareShipName('Cutlass Black plus Akuma Paint'), 'Cutlass Black');
  assert.equal(AL.bareShipName('Drake Cutlass Black'), 'Drake Cutlass Black');
  assert.deepEqual(AL.containsNames('Aurora MR and 3 other items'), ['Aurora MR']);
  assert.deepEqual(AL.containsNames('Cutlass Black, Avenger Titan · Gladius'), [
    'Cutlass Black',
    'Avenger Titan',
    'Gladius',
  ]);
});

test('readFeed: v1 only, every field checked, reading a saved copy changes nothing', () => {
  assert.equal(AL.readFeed(null), null);
  assert.equal(AL.readFeed({ ...FEED, v: 2 }), null);
  assert.equal(AL.readFeed({ v: 1, items: [] }), null);
  const f = AL.readFeed({
    ...FEED,
    items: [
      ...FEED.items,
      { id: 'sku-19700', kind: 'ship', name: 'Twice', ships: [] },
      { id: 'evil', kind: 'ship', name: 'Bad id' },
      { id: 'sku-1', kind: 'ship', name: '' },
      {
        id: 'sku-2',
        kind: 'ship',
        name: 'X',
        sale: ['new', 'warbond'],
        ships: ['Bad Slug', 'x'],
        endsOn: 'soon',
      },
    ],
    ships: [
      ...FEED.ships,
      { slug: 'Bad', name: 'x', keys: [] },
      { slug: 'y', name: 'Y', keys: ['Not Folded', 'y'] },
    ],
  });
  assert.equal(f.items.length, FEED.items.length + 1);
  const x = f.items.find((i) => i.id === 'sku-2');
  assert.deepEqual(x.sale, ['warbond'], 'only the kinds v1 knows; never "new"');
  assert.deepEqual(x.ships, ['x']);
  assert.equal(x.endsOn, null);
  assert.deepEqual(f.ships.find((s) => s.slug === 'y').keys, ['y']);
  assert.ok(!f.ships.some((s) => s.slug === 'Bad'));
  assert.deepEqual(AL.readFeed(f), f);
  assert.deepEqual(AL.readFeed(JSON.parse(JSON.stringify(f))), f);
});

test('readWish: the Wishlist keys, nothing else', () => {
  assert.equal(AL.readWish({ keys: [] }), null);
  assert.deepEqual(
    AL.readWish({
      v: 1,
      keys: ['ship:cutlass-black', 'sku:12', 'ccu:7', 'ship:Bad', 'sku:0', 'note:x', 'sku:12', 5],
    }),
    ['ship:cutlass-black', 'sku:12', 'ccu:7'],
  );
});

test("the hangar's ships by the feed's spellings: sure ones only", () => {
  const index = AL.shipIndex(AL.readFeed(FEED));
  assert.equal(index.find('Drake Cutlass Black'), 'cutlass-black');
  assert.equal(index.find('MISC RAPTOR - Referral Reward'), 'raptor');
  assert.equal(index.find('Sabre Raven'), null, 'never the closest name');
  assert.equal(index.find('Cutlass'), null);
  const owned = AL.ownedShips(DB, index);
  assert.deepEqual([...owned.keys()].sort(), ['cutlass-black', 'misc-freelancer-max', 'raptor']);
  const backs = AL.buybackShips(DB, index);
  assert.deepEqual([...backs.keys()].sort(), ['constellation-andromeda', 'sabre-raven-ex']);
  // A key two ships share is nobody's.
  const twice = AL.shipIndex(
    AL.readFeed({
      v: 1,
      items: [],
      ships: [
        { slug: 'a', name: 'A', keys: ['nova'] },
        { slug: 'b', name: 'B', keys: ['nova', 'b'] },
      ],
    }),
  );
  assert.equal(twice.find('Nova'), null);
  assert.equal(twice.find('B'), 'b');
});

// RSI's renames (the parser rules' aliases): a pledge scanned before the rename and one
// scanned after are the same ship, found once. The first entry: Phoenix Emerald, now
// listed as Constellation Mk IV Phoenix Emerald.
test('a renamed ship matches by its old name and its new one, never a guess', () => {
  const RULES = require('../src/parser-rules.js').rules;
  assert.deepEqual(
    RULES.aliases.find((a) => a.old === 'Phoenix Emerald'),
    { old: 'Phoenix Emerald', now: 'Constellation Mk IV Phoenix Emerald' },
  );
  assert.deepEqual(AL.keysOf('Phoenix Emerald'), [
    'phoenix emerald',
    'constellation mk iv phoenix emerald',
  ]);
  const feed = (keys) =>
    AL.readFeed({
      v: 1,
      items: [],
      ships: [{ slug: 'constellation-phoenix-emerald', name: 'Phoenix Emerald', keys }],
    });
  const pledge = (id, label) => ({ id, name: label, contents: [{ kind: 'Ship', label }] });
  const before = pledge('1', 'Phoenix Emerald');
  const after = pledge('1', 'Constellation Mk IV Phoenix Emerald');
  // The feed under either name, the hangar under either name: one ship, no drop.
  for (const keys of [['constellation mk iv phoenix emerald'], ['phoenix emerald']]) {
    const index = AL.shipIndex(feed(keys));
    for (const p of [before, after]) {
      const owned = AL.ownedShips({ sources: { hangar: { items: [p] } } }, index);
      assert.deepEqual([...owned.keys()], ['constellation-phoenix-emerald']);
    }
    // Both scans' names in one hangar still count as one ship, not two.
    const both = AL.ownedShips({ sources: { hangar: { items: [before, after] } } }, index);
    assert.equal(both.size, 1);
    assert.equal(index.find('Phoenix Emerald - Referral Reward'), 'constellation-phoenix-emerald');
    assert.equal(index.find('Emerald'), null, 'exact names only');
    assert.equal(index.find('Constellation Phoenix'), null);
  }
});

const byId = (ms, id) => ms.find((m) => m.id === id);
const whys = (m) => (m ? m.why.map((w) => w.why) : []);

test('the hangar rules: a paint just in, warbond, limited sale (never a buy-back)', () => {
  const ms = AL.matchAll(AL.readFeed(FEED), DB, null);
  // Your Sabre Raven EX buy-back in the store: no alert (#695).
  assert.equal(byId(ms, 'sku-19700'), undefined);
  assert.equal(byId(ms, 'sku-19701'), undefined);
  // Owned ship sold as a warbond.
  assert.deepEqual(whys(byId(ms, 'sku-11')), ['warbond']);
  assert.deepEqual(byId(ms, 'sku-11').why[0].ships, ['MISC Freelancer MAX']);
  // A paint for your Cutlass Black that just arrived; not the old one, not the one you own.
  assert.deepEqual(whys(byId(ms, 'sku-20')), ['paint']);
  assert.deepEqual(byId(ms, 'sku-20').why[0].ships, ['Cutlass Black']);
  assert.equal(byId(ms, 'sku-21'), undefined);
  assert.equal(byId(ms, 'sku-22'), undefined, 'a paint you own');
  // Your Cutlass Black on sale, plain: nothing to say. Gear and upgrades: not a hangar rule.
  assert.equal(byId(ms, 'sku-10'), undefined);
  assert.equal(byId(ms, 'sku-30'), undefined);
  assert.equal(byId(ms, 'upgrade-341'), undefined);
  // The CCU'd Raven EX in the hangar isn't owned (it's an upgrade pledge).
  assert.ok(!ms.some((m) => m.why.some((w) => w.why === 'limited')));
});

test('owning the ship on a limited sale', () => {
  const db = structuredClone(DB);
  db.sources.hangar.items.push({
    id: '9',
    name: 'Sabre Raven EX',
    contents: [ship('Sabre Raven EX')],
  });
  const ms = AL.matchAll(AL.readFeed(FEED), db, null);
  assert.deepEqual(whys(byId(ms, 'sku-19700')), ['limited']);
  assert.deepEqual(whys(byId(ms, 'sku-19701')), ['warbond', 'limited']);
  assert.equal(byId(ms, 'sku-19700').endsOn, '2026-10-15');
});

test('a paint alert only for a ship still on its default paint', () => {
  const feed = AL.readFeed({
    ...FEED,
    items: [
      ...FEED.items,
      {
        id: 'sku-23',
        kind: 'paint',
        name: 'Cutlass - Ember Paint',
        price: 15,
        sale: [],
        ships: ['cutlass-black'],
      },
    ],
  });
  assert.deepEqual(whys(byId(AL.matchAll(feed, DB, null), 'sku-20')), ['paint']);
  const db = structuredClone(DB);
  db.sources.hangar.items.push({
    id: '10',
    name: 'Paints - Cutlass - Ember Paint',
    isPaint: true,
    contents: [{ kind: 'Skin', label: 'Cutlass - Ember Paint' }],
  });
  assert.equal(byId(AL.matchAll(feed, db, null), 'sku-20'), undefined);
});

test('saved buy-back alerts clear out: items, memory, badge', () => {
  const old = {
    v: 1,
    items: [
      { id: 'sku-19700', name: 'X', why: [{ why: 'buyback', ships: ['A'] }] },
      {
        id: 'sku-11',
        name: 'Y',
        why: [
          { why: 'buyback', ships: ['A'] },
          { why: 'warbond', ships: ['B'] },
        ],
      },
    ],
    known: { 'sku-19700|buyback': 1, 'sku-11|buyback': 1, 'sku-11|warbond': 1 },
    seen: { 'sku-11|buyback': 2 },
    gone: { 'sku-19700|buyback': 3 },
    hidden: { 'sku-19700|buyback': 3 },
  };
  assert.deepEqual(
    AL.shown(old).map((m) => [m.id, whys(m)]),
    [['sku-11', ['warbond']]],
  );
  // A hangar reason only: Fleet News, never the badge.
  assert.equal(AL.badgeFor(true, old), null);
  const { state } = AL.nextState(old, [], NOW);
  assert.deepEqual(Object.keys(state.known), ['sku-11|warbond']);
  assert.deepEqual(state.seen, {});
  assert.equal('hidden' in state, false);
});

test('the Wishlist: only when connected, by its keys (ship page, store id, upgrade)', () => {
  const feed = AL.readFeed(FEED);
  const wish = ['ship:cutlass-black', 'sku:30', 'ccu:341'];
  const ms = AL.matchAll(feed, { sources: {} }, wish);
  assert.deepEqual(ms.map((m) => m.id).sort(), ['sku-10', 'sku-30', 'upgrade-341']);
  assert.ok(ms.every((m) => whys(m).join() === 'wishlist'));
  // Each with the Wishlist keys it answers to (the badge counts those).
  assert.deepEqual(byId(ms, 'sku-10').why[0].keys, ['ship:cutlass-black']);
  // A ship on the Wishlist never lights up a paint for it.
  assert.equal(byId(ms, 'sku-20'), undefined);
  assert.deepEqual(AL.matchAll(feed, { sources: {} }, null), []);
  assert.deepEqual(AL.wishKeysOf(feed.items[0]), ['sku:19700', 'ship:sabre-raven-ex']);
  assert.deepEqual(AL.wishKeysOf(feed.items.at(-1)), ['ccu:341']);
});

test("what's been seen: new pairs alert, a short gap doesn't, a day gone alerts again", () => {
  const feed = AL.readFeed(FEED);
  const ms = AL.matchAll(feed, DB, null);
  const a = AL.nextState(null, ms, NOW);
  assert.equal(a.fresh.length, ms.length);
  assert.equal(AL.unseen(a.state).length, ms.length);
  // The same again: nothing new.
  const b = AL.nextState(a.state, ms, NOW + 30 * MIN);
  assert.equal(b.fresh.length, 0);
  // Seen (the popup opened): nothing waits.
  const seen = AL.markSeen(b.state, NOW + 31 * MIN);
  assert.equal(AL.unseen(seen).length, 0);
  // A reason added to an item: that item again.
  const db = structuredClone(DB);
  db.sources.hangar.items.push({
    id: '9',
    name: 'Sabre Raven EX',
    contents: [ship('Sabre Raven EX')],
  });
  const c = AL.nextState(seen, AL.matchAll(feed, db, null), NOW + 60 * MIN);
  assert.deepEqual(c.fresh.map((m) => m.id).sort(), ['sku-19700', 'sku-19701']);
  assert.deepEqual(
    AL.unseen(c.state)
      .map((m) => m.id)
      .sort(),
    ['sku-19700', 'sku-19701'],
  );
  // Sold out for a read, back the next: no new alert.
  const without = ms.filter((m) => m.id !== 'sku-11');
  const gone = AL.nextState(seen, without, NOW + 2 * HOUR);
  assert.equal(AL.nextState(gone.state, ms, NOW + 3 * HOUR).fresh.length, 0);
  // Gone for a day: forgotten, so it alerts again when it's back.
  const long = AL.nextState(gone.state, without, NOW + 2 * HOUR + AL.GONE_KEEP_MS);
  assert.deepEqual(
    AL.nextState(long.state, ms, NOW + 30 * HOUR).fresh.map((m) => m.id),
    ['sku-11'],
  );
  // One item seen (its notification clicked).
  const one = AL.markSeen(a.state, NOW, 'sku-11');
  assert.equal(AL.unseen(one).length, ms.length - 1);
});

test('deleted in the old alerts list (#701): that memory dropped when read, still seen', () => {
  const ms = AL.matchAll(AL.readFeed(FEED), DB, null);
  const a = AL.nextState(null, ms, NOW);
  // As the popup's old list saved a deleted item: hidden, and seen with it.
  const pair = `sku-11|${ms.find((m) => m.id === 'sku-11').why[0].why}`;
  const old = {
    ...a.state,
    seen: { ...a.state.seen, [pair]: NOW },
    hidden: { [pair]: NOW },
  };
  assert.ok(AL.shown(old).some((m) => m.id === 'sku-11'));
  assert.equal(AL.unseen(old).length, ms.length - 1);
  const later = AL.nextState(old, ms, NOW + 30 * MIN);
  assert.equal('hidden' in later.state, false);
  assert.equal(later.fresh.length, 0);
});

test('notifications: one each, three at most, then one for the rest', () => {
  const real = AL.matchAll(AL.readFeed(FEED), DB, null);
  assert.equal(real.length, 2);
  const ms = [...real, ...real.map((m) => ({ ...m, id: `${m.id}-b` }))];
  const three = AL.notesFor(ms.slice(0, 3));
  assert.equal(three.length, 3);
  assert.deepEqual(AL.notesFor([byId(ms, 'sku-11')])[0], {
    id: 'oh-alerts:sku-11',
    title: 'Freelancer MAX',
    message: 'Warbond edition in the store: MISC Freelancer MAX (new money only)',
  });
  // Three of their own, then one for the rest (the privacy policy's words).
  const four = AL.notesFor(ms);
  assert.equal(four.length, 4);
  assert.deepEqual(
    four.slice(0, 3).map((n) => n.id),
    ms.slice(0, 3).map((m) => `oh-alerts:${m.id}`),
  );
  assert.equal(four[3].id, 'oh-alerts:more');
  assert.equal(four[3].title, 'More alerts: 1');
  const ends = AL.lines({ ...byId(ms, 'sku-11'), endsOn: '2026-10-15' });
  assert.deepEqual(ends, [
    'Warbond edition in the store: MISC Freelancer MAX (new money only)',
    'Ends Oct 15',
  ]);
});

test('the badge: Remind Me items on sale, unseen, each Wishlist item once', () => {
  const feed = AL.readFeed(FEED);
  // The hangar's reasons alone: Fleet News only, no badge.
  const own = AL.nextState(null, AL.matchAll(feed, DB, null), NOW);
  assert.ok(own.state.items.length > 0);
  assert.equal(AL.badgeFor(true, own.state), null);
  assert.deepEqual(own.remind, []);
  // A ship on the Wishlist sold in two editions counts once; a store item once.
  const two = {
    ...feed,
    items: [
      ...feed.items,
      { ...byId(feed.items, 'sku-10'), id: 'sku-99', name: 'Cutlass Black WB' },
    ],
  };
  const ms = AL.matchAll(two, DB, ['ship:cutlass-black', 'sku:30']);
  const { state, remind } = AL.nextState(null, ms, NOW);
  assert.deepEqual(remind.map((m) => m.id).sort(), ['sku-10', 'sku-30', 'sku-99']);
  assert.ok(
    remind.every((m) => whys(m).join() === 'wishlist'),
    'notified for the Wishlist only',
  );
  assert.deepEqual(AL.badgeFor(true, state), {
    text: '2',
    title: 'Open Hangar alerts: 2. Click to see them.',
  });
  assert.equal(AL.badgeFor(false, state), null);
  assert.equal(AL.badgeFor(undefined, state), null);
  assert.equal(AL.badgeFor(true, AL.markSeen(state, NOW)), null);
  // The same matches again: nothing new to notify.
  assert.deepEqual(AL.nextState(state, ms, NOW + 30 * MIN).remind, []);
  // Saved before the keys were kept: each item counts once.
  const many = {
    ...state,
    items: Array.from({ length: 12 }, (_, i) => ({
      id: `sku-${i + 1}`,
      why: [{ why: 'wishlist' }],
    })),
  };
  assert.equal(AL.badgeFor(true, many).text, '9+');
});

test('where things are: production feeds from openhangar.space, a dev site for both', () => {
  assert.deepEqual(AL.sitesOf(''), {
    site: 'https://app.openhangar.space',
    feeds: 'https://openhangar.space',
  });
  assert.deepEqual(AL.sitesOf('https://staging.openhangar.space/'), {
    site: 'https://staging.openhangar.space',
    feeds: 'https://staging.openhangar.space',
  });
  assert.equal(
    AL.itemUrl('https://openhangar.space', { id: 'sku-19700', name: 'X' }),
    'https://openhangar.space/store#item=19700',
  );
  assert.equal(
    AL.itemUrl('https://openhangar.space', {
      id: 'upgrade-341',
      name: 'Upgrade to Sabre Raven EX',
    }),
    'https://openhangar.space/store#item=Upgrade%20to%20Sabre%20Raven%20EX',
  );
  assert.equal(AL.paused({ data: { sources: { alerts: { enabled: false } } } }), true);
  assert.equal(AL.paused({ data: { sources: { hangar: { enabled: false } } } }), false);
  assert.equal(AL.paused(null), false);
});

test('timing: 30 to 35 minutes apart, never sooner, later when asked; backoff to 6 hours', () => {
  assert.equal(AL.nextAt(NOW, 0), NOW + 30 * MIN);
  assert.ok(AL.nextAt(NOW, 0.9999) < NOW + 35 * MIN);
  assert.equal(AL.nextAt(NOW, 0, NOW + 2 * HOUR), NOW + 2 * HOUR);
  assert.equal(AL.nextAt(NOW, 0, NOW + MIN), NOW + 30 * MIN, 'never under 30 minutes');
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 9].map(AL.backoffMs),
    [0.5, 1, 2, 4, 6, 6, 6].map((h) => h * HOUR),
  );
  assert.equal(AL.retryAfterMs('120', NOW), 120e3);
  assert.equal(AL.retryAfterMs(new Date(NOW + HOUR).toUTCString(), NOW), HOUR);
  assert.equal(AL.retryAfterMs('soon', NOW), 0);
  assert.equal(AL.retryAfterMs(String(9e6), NOW), 24 * HOUR);
});

// ---------- A check, with a stand-in browser ----------

const res = (status, body, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (n) => headers[n.toLowerCase()] ?? null },
  json: async () => body,
});
function env({ local = {}, net = [], share = true } = {}) {
  const data = structuredClone(local);
  const asked = [];
  const out = { notes: [], badges: 0, at: [], removed: [] };
  let clock = NOW;
  const e = {
    get: async (keys) =>
      Object.fromEntries(
        []
          .concat(keys)
          .filter((k) => k in data)
          .map((k) => [k, structuredClone(data[k])]),
      ),
    set: async (o) => void Object.assign(data, structuredClone(o)),
    remove: async (k) => [].concat(k).forEach((x) => (out.removed.push(x), delete data[x])),
    fetch: async (url, init) => {
      asked.push({ url, init });
      const next = net.shift();
      if (!next) throw new Error('no network');
      if (next instanceof Error) throw next;
      return next;
    },
    now: () => clock,
    rand: () => 0.5,
    mayShare: async () => share,
    notify: async (n) => void out.notes.push(...n),
    badge: async () => void out.badges++,
    schedule: async (at) => void out.at.push(at),
  };
  return { e, data, asked, out, tick: (ms) => (clock += ms) };
}
const LINK = { token: 'oht_test_token', name: 'Pilot', connectedAt: NOW - HOUR, lastSync: null };

test('a check: off asks nothing', async () => {
  const x = env({ local: { db: DB } });
  assert.deepEqual(await AL.check(x.e), { ran: false, why: 'off' });
  assert.equal(x.asked.length, 0);
});

test('a check, not connected: alerts go off, nothing asked (on only while connected)', async () => {
  const x = env({ local: { alertsOn: true, db: DB }, net: [res(200, FEED)] });
  assert.deepEqual(await AL.check(x.e), { ran: false, why: 'not-connected' });
  assert.equal(x.data.alertsOn, false);
  assert.equal(x.asked.length, 0);
  assert.equal(x.out.notes.length, 0);
  assert.equal(x.out.at.length, 0, 'no next check');
  assert.ok(!('alerts' in x.data), 'no matches saved');
  // A link without a token is no connection either.
  const y = env({ local: { alertsOn: true, db: DB, siteLink: { token: '' } } });
  assert.deepEqual(await AL.check(y.e), { ran: false, why: 'not-connected' });
});

test("a check, connected: the popup's Wishlist copy, if fresh, is used instead of a second read", async () => {
  const copy = (over = {}) => ({
    connectedAt: LINK.connectedAt,
    at: NOW - 60e3,
    items: [
      { key: 'ship:cutlass-black', name: 'Cutlass Black', remind: true, inHangar: false },
      { key: 'ship:zeus', name: 'Zeus', remind: false, inHangar: false },
      { key: 'ship:aurora-mr', name: 'Aurora MR', remind: true, inHangar: true },
    ],
    ...over,
  });
  const run = async (popupWish) => {
    const x = env({
      local: { alertsOn: true, db: { sources: {} }, siteLink: LINK, popupWish },
      net: [res(200, FEED), res(200, { v: 1, keys: ['ship:cutlass-black'] })],
    });
    await AL.check(x.e);
    return x;
  };
  // Fresh, this connection's, every item carrying the In Your Hangar mark: no second read;
  // the keys leave out Remind Me off and the marked items.
  const fresh = await run(copy());
  assert.equal(fresh.asked.length, 1, 'only the sale feed was asked');
  assert.deepEqual(fresh.data.alertsWish.keys, ['ship:cutlass-black']);
  // Any item without the mark (the website doesn't send it): its own read, as before.
  const unmarked = copy();
  delete unmarked.items[1].inHangar;
  const own = await run(unmarked);
  assert.equal(own.asked.length, 2, 'asked the website itself');
  assert.deepEqual(own.data.alertsWish.keys, ['ship:cutlass-black']);
  // Old (5 minutes or more), another connection's, or read only (no items): asked as before.
  for (const old of [
    copy({ at: NOW - 5 * 60e3 }),
    copy({ connectedAt: 'other' }),
    copy({ items: null }),
    undefined,
  ])
    assert.equal((await run(old)).asked.length, 2);
});

test('on only while connected: the stored fix, with literal keys and values', () => {
  // Migrated: on, and no connection (none, or one without a token).
  assert.deepEqual(AL.connectedOnly({ alertsOn: true }), { alertsOn: false });
  assert.deepEqual(AL.connectedOnly({ alertsOn: true, siteLink: null }), { alertsOn: false });
  assert.deepEqual(AL.connectedOnly({ alertsOn: true, siteLink: { token: '' } }), {
    alertsOn: false,
  });
  // Unchanged: connected, or already off, or never set.
  assert.equal(AL.connectedOnly({ alertsOn: true, siteLink: { token: 't' } }), null);
  assert.equal(AL.connectedOnly({ alertsOn: false }), null);
  assert.equal(AL.connectedOnly({}), null);
  assert.equal(AL.connectedOnly(null), null);
});

test("a check, connected: the account's Wishlist with the sync token, matched here", async () => {
  const x = env({
    local: {
      alertsOn: true,
      db: { sources: {} },
      siteLink: LINK,
      siteUrl: 'https://app.openhangar.space',
    },
    net: [res(200, FEED), res(200, { v: 1, keys: ['ship:cutlass-black'] })],
  });
  const r = await AL.check(x.e);
  assert.equal(r.matches, 1);
  assert.equal(x.asked[1].url, 'https://app.openhangar.space/api/v1/wishlist');
  assert.equal(x.asked[1].init.headers.Authorization, 'Bearer oht_test_token');
  assert.equal(x.asked[1].init.credentials, 'omit');
  // The feed never carries the token.
  assert.ok(!JSON.stringify(x.asked[0]).includes('oht_'));
  assert.deepEqual(
    x.data.alerts.items.map((m) => m.id),
    ['sku-10'],
  );
  assert.equal(x.data.alertsWish.connectedAt, LINK.connectedAt);
  // Firefox without its data yes: the Wishlist can't be read, so alerts go off (the
  // public feed's record kept, nothing matched or notified).
  const ff = env({
    local: { alertsOn: true, db: DB, siteLink: LINK },
    net: [res(200, FEED)],
    share: false,
  });
  assert.deepEqual(await AL.check(ff.e), { ran: false, why: 'no-share' });
  assert.equal(ff.asked.length, 1);
  assert.equal(ff.data.alertsOn, false);
  assert.ok(ff.data.alertsFeed.data, "the public feed's record stays");
  assert.ok(!('alerts' in ff.data));
  assert.equal(ff.out.notes.length, 0);
});

test('polite: ETag, a fresh copy reused, Retry-After honored, backoff, the last copy kept', async () => {
  // Connected, with the Wishlist read kept for hours, so only the feed is asked here.
  const wish = { keys: ['sku:1'], connectedAt: LINK.connectedAt, retryAt: NOW + 100 * HOUR };
  const x = env({
    local: { alertsOn: true, db: DB, siteLink: LINK, alertsWish: wish },
    net: [res(200, FEED, { etag: 'W/"a"' })],
  });
  await AL.check(x.e);
  // Ten minutes: the saved copy, nothing asked.
  x.tick(5 * MIN);
  await AL.check(x.e);
  assert.equal(x.asked.length, 1);
  // Later: asked with the ETag; 304 keeps the copy.
  x.tick(30 * MIN);
  x.asked.length = 0;
  await AL.check({
    ...x.e,
    fetch: async (url, init) => (x.asked.push({ url, init }), res(304, null)),
  });
  assert.equal(x.asked[0].init.headers['If-None-Match'], 'W/"a"');
  assert.equal(x.data.alertsFeed.data.items.length, FEED.items.length);
  // 429 with Retry-After: no request before it, the next check after it.
  x.tick(31 * MIN);
  const at429 = NOW + 66 * MIN;
  await AL.check({ ...x.e, fetch: async () => res(429, null, { 'retry-after': '7200' }) });
  assert.equal(x.data.alertsFeed.retryAt, at429 + 2 * HOUR);
  assert.equal(x.out.at.at(-1), at429 + 2 * HOUR);
  x.tick(HOUR);
  x.asked.length = 0;
  await AL.check(x.e);
  assert.equal(x.asked.length, 0, 'still waiting');
  // Offline: the wait doubles, the last copy still matches.
  x.tick(HOUR + MIN);
  const before = x.data.alertsFeed.fails;
  await AL.check({ ...x.e, fetch: async () => Promise.reject(new Error('offline')) });
  assert.equal(x.data.alertsFeed.fails, before + 1);
  assert.equal(x.data.alertsFeed.data.items.length, FEED.items.length);
  assert.equal(x.data.alerts.items.length, 2);
});

test('the Wishlist read: 404 (its flag off) waits 6 hours, 401 keeps nothing', async () => {
  const x = env({
    local: { alertsOn: true, db: { sources: {} }, siteLink: LINK },
    net: [res(200, FEED), res(404, { error: 'not found' })],
  });
  await AL.check(x.e);
  assert.equal(x.data.alertsWish.keys, null);
  assert.equal(x.data.alertsWish.retryAt, NOW + AL.WISH_OFF_MS);
  const y = env({
    local: {
      alertsOn: true,
      db: { sources: {} },
      siteLink: LINK,
      alertsWish: { keys: ['ship:cutlass-black'], connectedAt: LINK.connectedAt, retryAt: NOW - 1 },
    },
    net: [res(200, FEED), res(401, { error: 'not connected' })],
  });
  await AL.check(y.e);
  assert.equal(y.data.alertsWish.keys, null);
  assert.deepEqual(y.data.alerts.items, []);
});

test('disconnected: alerts go off, nothing asked or scheduled', async () => {
  const x = env({
    local: {
      alertsOn: true,
      db: { sources: {} },
      alertsFeed: { data: AL.readFeed(FEED), at: NOW - MIN, fails: 0 },
      alertsWish: {
        keys: ['ship:cutlass-black'],
        connectedAt: LINK.connectedAt,
        retryAt: NOW + HOUR,
      },
    },
  });
  // The background clears the matches and the Wishlist keys on the off (OFF_KEYS).
  assert.deepEqual(await AL.check(x.e, { network: false }), {
    ran: false,
    why: 'not-connected',
  });
  assert.equal(x.data.alertsOn, false);
  assert.equal(x.asked.length, 0);
  assert.equal(x.out.at.length, 0, 'matching again schedules nothing');
  assert.ok(AL.OFF_KEYS.includes('alertsWish') && AL.OFF_KEYS.includes('alerts'));
});

test('the kill switch pauses the checks: nothing asked', async () => {
  const x = env({
    local: {
      alertsOn: true,
      db: DB,
      siteLink: LINK,
      remoteStatus: { at: NOW, data: { sources: { alerts: { enabled: false } } } },
    },
    net: [res(200, FEED)],
  });
  assert.deepEqual(await AL.check(x.e), { ran: false, why: 'paused' });
  assert.equal(x.asked.length, 0);
  assert.equal(x.out.at.length, 1);
});

test("every word alerts show is the owner's (2026-10-13), no placeholder left", () => {
  for (const [k, v] of Object.entries(AL.COPY)) assert.doesNotMatch(v, /\[copy:/, k);
  assert.equal(AL.COPY['alerts.why.wishlist'], 'On your Wishlist');
});

test('a check, connected, Remind Me on for nothing: alerts go off, nothing matched or notified', async () => {
  const x = env({
    local: { alertsOn: true, db: DB, siteLink: LINK },
    net: [res(200, FEED), res(200, { v: 1, keys: [] })],
  });
  assert.deepEqual(await AL.check(x.e), { ran: false, why: 'no-remind' });
  assert.equal(x.data.alertsOn, false);
  assert.equal(x.out.notes.length, 0);
  assert.ok(!('alerts' in x.data), 'no matches saved');
  // A Wishlist that answers 404 (its flag off) isn't "none on": the hangar rules still run.
  const off = env({
    local: { alertsOn: true, db: DB, siteLink: LINK },
    net: [res(200, FEED), res(404, {})],
  });
  assert.equal((await AL.check(off.e)).ran, true);
  assert.notEqual(off.data.alertsOn, false);
});
