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
  assert.equal(AL.badgeFor(true, old).text, '1');
  const { state } = AL.nextState(old, [], NOW);
  assert.deepEqual(Object.keys(state.known), ['sku-11|warbond']);
  assert.deepEqual(state.seen, {});
  assert.deepEqual(state.hidden, {});
});

test('the Wishlist: only when connected, by its keys (ship page, store id, upgrade)', () => {
  const feed = AL.readFeed(FEED);
  const wish = ['ship:cutlass-black', 'sku:30', 'ccu:341'];
  const ms = AL.matchAll(feed, { sources: {} }, wish);
  assert.deepEqual(ms.map((m) => m.id).sort(), ['sku-10', 'sku-30', 'upgrade-341']);
  assert.ok(ms.every((m) => whys(m).join() === 'wishlist'));
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

test('deleted (#701): out of the list and the badge, back only when something new matches', () => {
  const feed = AL.readFeed(FEED);
  const ms = AL.matchAll(feed, DB, null);
  const a = AL.nextState(null, ms, NOW);
  assert.equal(AL.shown(a.state).length, ms.length);
  // One deleted: gone from the list and the badge, and it stays gone on the next checks.
  const one = AL.hide(a.state, NOW, 'sku-11');
  assert.ok(!AL.shown(one).some((m) => m.id === 'sku-11'));
  assert.equal(AL.unseen(one).length, ms.length - 1);
  const later = AL.nextState(one, ms, NOW + 30 * MIN);
  assert.equal(later.fresh.length, 0);
  assert.ok(!AL.shown(later.state).some((m) => m.id === 'sku-11'));
  // Read back after a restart (stored as JSON): still gone.
  const stored = JSON.parse(JSON.stringify(later.state));
  assert.ok(!AL.shown(stored).some((m) => m.id === 'sku-11'));
  // Clear All: nothing listed, nothing on the badge.
  const all = AL.hide(later.state, NOW + HOUR);
  assert.equal(AL.shown(all).length, 0);
  assert.equal(AL.unseen(all).length, 0);
  // A new reason for an item: it shows again.
  const db = structuredClone(DB);
  db.sources.hangar.items.push({
    id: '9',
    name: 'Sabre Raven EX',
    contents: [ship('Sabre Raven EX')],
  });
  const more = AL.nextState(all, AL.matchAll(feed, db, null), NOW + 2 * HOUR);
  assert.deepEqual(
    AL.shown(more.state)
      .map((m) => m.id)
      .sort(),
    ['sku-19700', 'sku-19701'],
  );
  // The same sale gone a day and back: it alerts and shows again.
  const without = ms.filter((m) => m.id !== 'sku-11');
  const gone = AL.nextState(all, without, NOW + 2 * HOUR);
  const long = AL.nextState(gone.state, without, NOW + 2 * HOUR + AL.GONE_KEEP_MS);
  const back = AL.nextState(long.state, ms, NOW + 30 * HOUR);
  assert.deepEqual(
    back.fresh.map((m) => m.id),
    ['sku-11'],
  );
  assert.deepEqual(
    AL.shown(back.state).map((m) => m.id),
    ['sku-11'],
  );
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

test('the badge: unseen items while alerts are on, else the rescan reminder', () => {
  const ms = AL.matchAll(AL.readFeed(FEED), DB, null);
  const { state } = AL.nextState(null, ms, NOW);
  assert.deepEqual(AL.badgeFor(true, state), {
    text: '2',
    title: 'Open Hangar alerts: 2. Click to see them.',
  });
  assert.equal(AL.badgeFor(false, state), null);
  assert.equal(AL.badgeFor(undefined, state), null);
  assert.equal(AL.badgeFor(true, AL.markSeen(state, NOW)), null);
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

test('a check, not connected: the public feed only, with nothing of the pilot in it', async () => {
  const x = env({ local: { alertsOn: true, db: DB }, net: [res(200, FEED, { etag: 'W/"a"' })] });
  const r = await AL.check(x.e);
  assert.equal(r.ran, true);
  assert.equal(r.matches, 2);
  assert.equal(x.asked.length, 1);
  const [{ url, init }] = x.asked;
  assert.equal(url, 'https://openhangar.space/api/store/on-sale');
  assert.equal(init.credentials, 'omit');
  assert.deepEqual(init.headers, { Accept: 'application/json' });
  assert.ok(!('body' in init) && !init.method, 'a plain GET');
  assert.equal(x.out.notes.length, 2);
  assert.equal(x.out.badges, 1);
  assert.deepEqual(x.out.at, [NOW + 30 * MIN + 150e3]);
  assert.equal(x.data.alertsFeed.etag, 'W/"a"');
  assert.equal(x.data.alerts.checkedAt, NOW);
  assert.ok(!('alertsWish' in x.data));
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
  // Firefox without its data yes: no Wishlist read, the hangar rules only.
  const ff = env({
    local: { alertsOn: true, db: DB, siteLink: LINK },
    net: [res(200, FEED)],
    share: false,
  });
  await AL.check(ff.e);
  assert.equal(ff.asked.length, 1);
  assert.ok(!ff.data.alerts.items.some((m) => whys(m).includes('wishlist')));
});

test('polite: ETag, a fresh copy reused, Retry-After honored, backoff, the last copy kept', async () => {
  const x = env({ local: { alertsOn: true, db: DB }, net: [res(200, FEED, { etag: 'W/"a"' })] });
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

test('disconnected: the Wishlist keys go, its matches with them', async () => {
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
  await AL.check(x.e, { network: false });
  assert.equal(x.asked.length, 0);
  assert.ok(!('alertsWish' in x.data));
  assert.deepEqual(x.data.alerts.items, []);
  assert.equal(x.out.at.length, 0, 'matching again schedules nothing');
});

test('the kill switch pauses the checks: nothing asked', async () => {
  const x = env({
    local: {
      alertsOn: true,
      db: DB,
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
