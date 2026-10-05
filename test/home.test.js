'use strict';

/* Home live data: wiki main page settings (event + patches) and buy-back tokens. Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

// Shape of Module:Mainpage/settings.json on starcitizen.tools (trimmed), as read
// on 2026-09-30: the Pirate Week card was still up two weeks after it ended.
const SETTINGS = {
  event: {
    name: 'Pirate Week',
    page: 'Pirate week',
    text: 'Hunting for treasure and solving clues',
    starts: '2026-09-9 16:00',
    ends: '2026-09-16 20:00',
  },
  patches: [
    {
      channel: 'LIVE',
      name: '4.10.1',
      page: 'Update:Star Citizen Alpha 4.10.1',
      highlights: ['x'],
    },
    { channel: 'eptu', name: '4.10.2', page: 'Update:Star Citizen Alpha 4.10.2' },
    { channel: 'PTU' }, // incomplete rows are dropped
  ],
};

test('parseWikiTime reads unpadded wiki dates as UTC', () => {
  assert.equal(OH.parseWikiTime('2026-09-9 16:00'), Date.UTC(2026, 8, 9, 16, 0));
  assert.equal(OH.parseWikiTime('2026-10-05'), Date.UTC(2026, 9, 5));
  assert.ok(Number.isNaN(OH.parseWikiTime('')));
  assert.ok(Number.isNaN(OH.parseWikiTime('soon')));
});

test('shapeWikiMainpage keeps the event and normalised patches', () => {
  const m = OH.shapeWikiMainpage(SETTINGS);
  assert.equal(m.event.name, 'Pirate Week');
  assert.equal(m.event.ends, Date.UTC(2026, 8, 16, 20, 0));
  assert.deepEqual(
    m.patches.map((p) => `${p.channel} ${p.name}`),
    ['LIVE 4.10.1', 'EPTU 4.10.2'],
  );
  assert.deepEqual(OH.shapeWikiMainpage({}), { event: null, patches: [] });
});

test('activeWikiEvent hides an event whose dates are over (stale wiki card)', () => {
  const m = OH.shapeWikiMainpage(SETTINGS);
  assert.equal(OH.activeWikiEvent(m, Date.UTC(2026, 8, 30)), null); // Sept 30: ended Sept 16
  assert.equal(OH.activeWikiEvent(m, Date.UTC(2026, 8, 12))?.name, 'Pirate Week'); // mid-event
  assert.equal(OH.activeWikiEvent(m, Date.UTC(2026, 8, 1)), null); // not started yet
  const noEnd = OH.shapeWikiMainpage({ event: { name: 'X', starts: '2026-09-1' } });
  assert.equal(OH.activeWikiEvent(noEnd, Date.UTC(2026, 8, 12)), null); // can't tell it's over
  assert.equal(OH.activeWikiEvent(null), null);
});

test('nextBuybackToken: the listed date, then the first Monday of the next quarter', () => {
  assert.equal(OH.nextBuybackToken(Date.UTC(2026, 8, 30)), Date.parse('2026-10-05T12:00:00Z'));
  // Past the list: Mon Jan 4 2027, then Mon Apr 5, Mon Jul 5, Mon Oct 4.
  assert.equal(OH.nextBuybackToken(Date.UTC(2026, 9, 5, 18)), Date.parse('2027-01-04T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2026, 11, 1)), Date.parse('2027-01-04T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2027, 0, 4, 13)), Date.parse('2027-04-05T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2027, 5, 1)), Date.parse('2027-07-05T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2027, 6, 6)), Date.parse('2027-10-04T12:00:00Z'));
});

// RSI Spectrum Patch Notes channel, first 8 threads as read on 2026-09-30.
const PATCH = require('./fixtures/patch-notes.json');

test('parsePatchNotes reads label, version, link and date, newest first', () => {
  const n = OH.parsePatchNotes(PATCH);
  assert.equal(n.length, 8);
  assert.equal(n[0].label, 'Wave 3 PTU');
  assert.equal(n[0].title, 'Star Citizen Alpha 4.10.2 PTU Patch Notes'); // build number dropped
  assert.equal(n[0].version, '4.10.2');
  assert.match(n[0].url, /\/forum\/190048\/thread\/star-citizen-alpha-4-10-2-ptu-patch-notes-2$/);
  assert.ok(n.every((x, i) => i === 0 || n[i - 1].at >= x.at));
  assert.deepEqual(OH.parsePatchNotes({}), []);
});

test('patchWave finds the newest wave for a test version', () => {
  const n = OH.parsePatchNotes(PATCH);
  assert.equal(OH.patchWave(n, '4.10.2'), 'Wave 3');
  assert.equal(OH.patchWave(n, '9.9.9'), '');
});

test('soonBuybackToken: only in the last 30 days before a token', () => {
  // 2027-01-04 is the next one after 2026-10-05.
  assert.equal(OH.soonBuybackToken(Date.UTC(2026, 9, 6)), null); // ~90 days away
  assert.equal(OH.soonBuybackToken(Date.UTC(2026, 11, 10)), Date.parse('2027-01-04T12:00:00Z'));
  assert.equal(OH.soonBuybackToken(Date.UTC(2026, 8, 30)), Date.parse('2026-10-05T12:00:00Z'));
});
