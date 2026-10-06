'use strict';

/* RSI Quick Links (ui/lib/quick-links.js, #374): plain links to RSI pages. Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../ui/lib/quick-links.js');
const RSI_HOST = /^(?:[a-z0-9-]+\.)?robertsspaceindustries\.com$/;

test('every link is https on RSI or an RSI subdomain', async () => {
  const { QUICK_LINKS, quickLinks } = await load();
  const all = [...QUICK_LINKS, ...quickLinks('Some_Pilot')].flatMap((g) => g.links);
  assert.ok(all.length > 20);
  for (const l of all) {
    const u = new URL(l.u);
    assert.equal(u.protocol, 'https:', l.t);
    assert.match(u.hostname, RSI_HOST, l.t);
    assert.equal(u.username + u.password, '', l.t);
  }
});

test('no duplicate labels or URLs, and every link has an icon', async () => {
  const { quickLinks, QL_ICONS } = await load();
  const links = quickLinks('Some_Pilot').flatMap((g) => g.links);
  const labels = links.map((l) => l.t);
  const urls = links.map((l) => l.u);
  assert.equal(new Set(labels).size, labels.length, 'labels');
  assert.equal(new Set(urls).size, urls.length, 'URLs');
  for (const l of links) assert.ok(QL_ICONS[l.i], `${l.t}: icon ${l.i}`);
});

test('labels are Title Case, with no em dashes', async () => {
  const { quickLinks } = await load();
  const small = new Set(['and', 'to', 'the', 'on', 'of']);
  for (const g of quickLinks('x')) {
    for (const text of [g.name, ...g.links.map((l) => l.t)]) {
      assert.ok(!text.includes('—'), text);
      for (const w of text.split(/\s+/))
        assert.ok(small.has(w) || /^[A-Z0-9]/.test(w), `"${w}" in "${text}"`);
    }
    for (const l of g.links) if (l.d) assert.ok(!l.d.includes('—'), l.d);
  }
});

test('the Citizen Dossier uses your handle, and goes while it is unknown', async () => {
  const { quickLinks, DOSSIER } = await load();
  const find = (gs) => gs.flatMap((g) => g.links).find((l) => l.t === DOSSIER);
  assert.equal(
    find(quickLinks('Draco_Nebulae')).u,
    'https://robertsspaceindustries.com/en/citizens/Draco_Nebulae',
  );
  assert.equal(find(quickLinks('a b/c')).u.endsWith('/citizens/a%20b%2Fc'), true);
  assert.equal(find(quickLinks('')), undefined);
  assert.equal(find(quickLinks(undefined)), undefined);
  assert.equal(find(quickLinks('   ')), undefined);
});

test('the portrait menu leaves out the Home-only links', async () => {
  const { quickLinks } = await load();
  const names = (gs) => gs.flatMap((g) => g.links).map((l) => l.t);
  assert.ok(names(quickLinks('x')).includes('Handle Change Pass'));
  assert.ok(!names(quickLinks('x', { menu: true })).includes('Handle Change Pass'));
});
