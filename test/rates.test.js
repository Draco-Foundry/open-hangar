'use strict';
// scripts/update-rates.mjs: builds openhangar.space/rates.json from the ECB, with
// two stand-in sources and sanity checks (#243). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const rates = () => import('../scripts/update-rates.mjs');

const ECB = `<gesmes:Envelope><Cube><Cube time='2026-09-30'>
<Cube currency='USD' rate='1.1355'/><Cube currency='JPY' rate='178.27'/>
<Cube currency='GBP' rate='0.85463'/><Cube currency='CZK' rate='24.440'/>
<Cube currency='PLN' rate='4.3690'/><Cube currency='SEK' rate='11.3310'/>
<Cube currency='CHF' rate='0.9478'/><Cube currency='AUD' rate='1.6297'/>
<Cube currency='BRL' rate='5.9077'/><Cube currency='CAD' rate='1.6105'/>
<Cube currency='CNY' rate='7.6130'/><Cube currency='KRW' rate='1539.06'/>
<Cube currency='NZD' rate='2.0115'/></Cube></Cube></gesmes:Envelope>`;

test('every currency the extension offers is in the rates file', async () => {
  const { WANT } = await rates();
  assert.deepEqual([...WANT].sort(), OH.CURRENCIES.filter((c) => c !== 'USD').sort());
});

test('parseEcb turns EUR-based ECB rates into USD-based ones', async () => {
  const { parseEcb, check } = await rates();
  const r = parseEcb(ECB);
  assert.equal(r.date, '2026-09-30');
  assert.equal(r.rates.USD, 1);
  assert.equal(r.rates.EUR, Number((1 / 1.1355).toPrecision(6)));
  assert.equal(r.rates.GBP, Number((0.85463 / 1.1355).toPrecision(6)));
  assert.deepEqual(check(r, null), []);
  assert.equal(parseEcb('<html>maintenance</html>'), null);
});

test('stand-in sources parse to the same shape', async () => {
  const { parseFawaz, parseErApi, WANT } = await rates();
  const usd = Object.fromEntries(WANT.map((c) => [c.toLowerCase(), 2]));
  assert.equal(parseFawaz({ date: '2026-09-30', usd }).rates.EUR, 2);
  const er = parseErApi({
    result: 'success',
    time_last_update_utc: 'Wed, 30 Sep 2026 00:02:31 +0000',
    rates: Object.fromEntries(WANT.map((c) => [c, 3])),
  });
  assert.equal(er.date, '2026-09-30');
  assert.equal(er.rates.KRW, 3);
  assert.equal(parseErApi({ result: 'error' }), null);
});

test('check rejects missing currencies and wild jumps', async () => {
  const { parseEcb, check } = await rates();
  const r = parseEcb(ECB);
  const missing = { ...r, rates: { ...r.rates, JPY: undefined } };
  assert.deepEqual(check(missing, null), ['JPY missing']);
  const previous = { rates: { ...r.rates, EUR: r.rates.EUR * 2 } };
  assert.match(check(r, previous).join(), /EUR jumped/);
  assert.deepEqual(check(null, null), ['nothing read']);
});

test('pickRates tries the ECB, then the stand-ins, and says why each was skipped', async () => {
  const { pickRates, WANT } = await rates();
  const usd = Object.fromEntries(WANT.map((c) => [c.toLowerCase(), 2]));
  const asked = [];
  const warned = [];
  const file = await pickRates(
    null,
    async (url, as) => {
      asked.push(as);
      if (url.includes('ecb')) throw new Error('HTTP 503');
      return { date: '2026-10-31', usd };
    },
    (line) => warned.push(line),
  );
  assert.deepEqual(file, {
    base: 'USD',
    date: '2026-10-31',
    source: 'currency-api',
    rates: { USD: 1, ...Object.fromEntries(WANT.map((c) => [c, 2])) },
  });
  assert.deepEqual(asked, ['text', 'json']);
  assert.deepEqual(warned, ["ECB couldn't be read (HTTP 503)"]);
  // Nothing passes: null, with every source named.
  warned.length = 0;
  assert.equal(
    await pickRates(
      null,
      async () => ({}),
      (line) => warned.push(line),
    ),
    null,
  );
  assert.equal(warned.length, 3);
});

test('the shared rates module needs nothing from Node, so it bundles into the Worker', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.join(__dirname, '..', 'site-worker', 'src', 'rates.mjs');
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m);
  assert.doesNotMatch(src, /\brequire\(/);
});
