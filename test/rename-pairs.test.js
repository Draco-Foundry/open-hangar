'use strict';
// Rename pairs: a ship or paint the store names one way and the hangar another, run through
// the extension's own matching as it is today (src/lib.js makeShipIndex, the hangar's ship
// lookup; src/alerts.js shipIndex, ownedShips, buybackShips and the paint keys). The names
// are RSI spellings; every catalog row, feed and pledge here is made up for the test. A pair
// that doesn't match today is marked todo (an expected failure) and left as it is: a fix is a
// separate change.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;
const AL = require('../src/alerts.js');

// A made-up slice of the ship list, as the extension holds it (lname, name, cls, msrp).
const row = (name, cls, msrp) => ({ lname: name.toLowerCase(), name, cls, msrp });
const CATALOG = [
  row('F7C Hornet Mk II', 'anvl_hornet_f7c_mk2', 75),
  row('F7A Hornet Mk II', 'anvl_hornet_f7a_mk2', null),
  row('F7C-M Super Hornet Mk II', 'anvl_hornet_f7cm_mk2', 180),
  row('Ballista', 'anvl_ballista', 140),
  row('Ballista Dunestalker', 'anvl_ballista_dunestalker', null),
  row('Ballista Snowblind', 'anvl_ballista_snowblind', null),
  row('Centurion', 'anvl_centurion', 110),
  row('Spartan', 'anvl_spartan', 85),
  row('Ares Star Fighter Inferno', 'crus_starfighter_inferno', 250),
  row('Ares Star Fighter Ion', 'crus_starfighter_ion', 250),
];
const ships = OH.makeShipIndex(CATALOG);
const shipOf = (label) => (ships.shipOf(label) || {}).name || null;

// The website's sale feed for alerts gives each ship a slug and its spellings (folded keys).
// Here a ship's keys are its list name and the store spelling of the pair, as the feed would
// carry a store item's own name; the hangar spelling is what the extension must find.
const slugOf = (name) => AL.nameKey(name).replace(/ /g, '-');
const feedFor = (extra = {}) =>
  AL.readFeed({
    v: 1,
    items: [],
    ships: CATALOG.map((r) => ({
      slug: slugOf(r.name),
      name: r.name,
      keys: [...new Set([AL.nameKey(r.name), ...(extra[r.name] || []).map(AL.nameKey)])],
    })),
  });
const pledge = (label, kind = 'Ship') => ({ id: '1', name: label, contents: [{ kind, label }] });
const hangar = (...pledges) => ({ sources: { hangar: { items: pledges } } });

// Each pair: a store spelling and a hangar spelling of one ship, and the ship both mean.
const PAIRS = [
  // The Anvil HM6 vehicles: RSI's store and Ship Matrix write "Ballista", the game files
  // and some hangars "HM6 Ballista", and RSI's hangar can put the maker in front.
  { store: 'Ballista', hangar: 'HM6 Ballista', ship: 'Ballista' },
  { store: 'Ballista', hangar: 'Anvil Ballista', ship: 'Ballista' },
  {
    store: 'Ballista Dunestalker',
    hangar: 'Anvil HM6 Ballista Dunestalker',
    ship: 'Ballista Dunestalker',
  },
  { store: 'Ballista Snowblind', hangar: 'Anvil Ballista Snowblind', ship: 'Ballista Snowblind' },
  { store: 'Centurion', hangar: 'HM6 Centurion', ship: 'Centurion' },
  { store: 'Spartan', hangar: 'Anvil HM6 Spartan', ship: 'Spartan' },
  // The Ares: RSI's store slugs, new ("Ares-Inferno") and old ("Ares-Star-Fighter-Inferno"),
  // against the hangar's "Crusader Ares Star Fighter ..." and the plain Ship Matrix name.
  {
    store: 'Ares-Inferno',
    hangar: 'Crusader Ares Star Fighter Inferno',
    ship: 'Ares Star Fighter Inferno',
  },
  { store: 'Ares-Star-Fighter-Inferno', hangar: 'Ares Inferno', ship: 'Ares Star Fighter Inferno' },
  { store: 'Ares-Ion', hangar: 'Crusader Ares Star Fighter Ion', ship: 'Ares Star Fighter Ion' },
  { store: 'Ares-Star-Fighter-Ion', hangar: 'Ares Ion', ship: 'Ares Star Fighter Ion' },
];

// What doesn't match today (main, 2026-11-16): each is a todo, an expected failure, left
// unfixed. A todo that starts passing shows in the test report; then take it off this list.
const FAILS_TODAY = new Set([
  'lib store Ares-Inferno',
  'lib store Ares-Star-Fighter-Inferno',
  'lib store Ares-Ion',
  'lib store Ares-Star-Fighter-Ion',
  'lib hangar HM6 Ballista',
  'lib hangar Anvil HM6 Ballista Dunestalker',
  'lib hangar HM6 Centurion',
  'lib hangar Anvil HM6 Spartan',
  'alerts hangar HM6 Ballista',
  'alerts hangar Anvil Ballista',
  'alerts hangar Anvil HM6 Ballista Dunestalker',
  'alerts hangar Anvil Ballista Snowblind',
  'alerts hangar HM6 Centurion',
  'alerts hangar Anvil HM6 Spartan',
  'alerts hangar Crusader Ares Star Fighter Inferno',
  'alerts hangar Ares Inferno',
  'alerts hangar Crusader Ares Star Fighter Ion',
  'alerts hangar Ares Ion',
  'alerts paint Hornet Mk II',
  'alerts paint owned',
  'buyback Standalone Ship - Anvil HM6 Ballista',
  'buyback Standalone Ship - Ares Inferno',
]);
const todo = (k) => (FAILS_TODAY.has(k) ? 'fails today, left unfixed' : false);

for (const p of PAIRS) {
  for (const side of ['store', 'hangar'])
    test(
      `lib.js makeShipIndex, ${side}: "${p[side]}" is the ${p.ship}`,
      { todo: todo(`lib ${side} ${p[side]}`) },
      () => {
        assert.equal(shipOf(p[side]), p.ship);
      },
    );
  test(
    `alerts.js shipIndex: the feed's "${p.store}" owned as the hangar's "${p.hangar}"`,
    { todo: todo(`alerts hangar ${p.hangar}`) },
    () => {
      const index = AL.shipIndex(feedFor({ [p.ship]: [p.store] }));
      assert.deepEqual(
        [...AL.ownedShips(hangar(pledge(p.hangar)), index).keys()],
        [slugOf(p.ship)],
      );
    },
  );
}

// The paint pair: RSI's store sells "F7 Hornet Mk II - <paint>" for every Hornet Mk II,
// and a hangar lists the ship as plain "Hornet Mk II" and the paint without the "F7".
const PAINT_STORE = 'F7 Hornet Mk II - Nightfall Paint';
const HORNETS = ['F7C Hornet Mk II', 'F7A Hornet Mk II', 'F7C-M Super Hornet Mk II'];
test('lib.js makeShipIndex: the hangar\'s "Hornet Mk II" is a Hornet Mk II the store paint fits', () => {
  assert.ok(HORNETS.includes(shipOf('Hornet Mk II')), String(shipOf('Hornet Mk II')));
});
test(
  'alerts.js shipIndex: the hangar\'s "Hornet Mk II" is a Hornet Mk II the store paint fits',
  { todo: todo('alerts paint Hornet Mk II') },
  () => {
    const index = AL.shipIndex(feedFor());
    assert.ok(HORNETS.map(slugOf).includes(index.find('Hornet Mk II')));
  },
);
test(
  'alerts.js paint keys: a paint the hangar names without "F7" is owned under the store\'s name',
  { todo: todo('alerts paint owned') },
  () => {
    const feed = AL.readFeed({
      v: 1,
      ships: feedFor().ships,
      items: [
        {
          id: 'sku-9001',
          kind: 'paint',
          name: PAINT_STORE,
          sale: ['listed'],
          ships: ['f7c-hornet-mk-ii', 'f7a-hornet-mk-ii', 'f7c-m-super-hornet-mk-ii'],
        },
      ],
    });
    const db = hangar(
      pledge('F7C Hornet Mk II'),
      pledge('Hornet Mk II - Nightfall Paint', 'Paint'),
    );
    // Owning the paint: no "paint for your ship" alert for it.
    assert.deepEqual(
      AL.matchAll(feed, db, null).filter((m) => m.why.some((w) => w.why === 'paint')),
      [],
    );
  },
);

// Buy-backs (alerts.js buybackShips): a standalone ship's title in the store's other spelling.
test(
  'buy-back: "Standalone Ship - Anvil HM6 Ballista" gives back the Ballista',
  { todo: todo('buyback Standalone Ship - Anvil HM6 Ballista') },
  () => {
    const db = {
      sources: {
        buybacks: {
          items: [{ id: 'b1', kind: 'ship', name: 'Standalone Ship - Anvil HM6 Ballista' }],
        },
      },
    };
    assert.deepEqual([...AL.buybackShips(db, AL.shipIndex(feedFor())).keys()], ['ballista']);
  },
);
test(
  'buy-back: "Standalone Ship - Ares Inferno" gives back the Ares Star Fighter Inferno',
  { todo: todo('buyback Standalone Ship - Ares Inferno') },
  () => {
    const db = {
      sources: {
        buybacks: { items: [{ id: 'b2', kind: 'ship', name: 'Standalone Ship - Ares Inferno' }] },
      },
    };
    assert.deepEqual(
      [...AL.buybackShips(db, AL.shipIndex(feedFor())).keys()],
      ['ares-star-fighter-inferno'],
    );
  },
);
