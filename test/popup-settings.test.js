'use strict';
// The popup's Currency (ui/popup/currency.js), its signed-out check (ui/popup/rsi-cookie.js)
// and its exports (ui/popup/actions.js): no exchange rates asked for USD, RSI's sign-in
// cookie looked at for whether it's there and nothing more, and the three files.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const currency = () => import('../ui/popup/currency.js');
const cookie = () => import('../ui/popup/rsi-cookie.js');

// --- Currency ------------------------------------------------------------------------

test("the popup's currencies are lib.js's, in its order", async () => {
  const { CURRENCIES } = await currency();
  const was = { window: global.window, chrome: global.chrome };
  global.window = globalThis;
  global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
  try {
    delete require.cache[require.resolve('../src/lib.js')];
    require('../src/lib.js');
    assert.deepEqual(CURRENCIES, globalThis.OH.CURRENCIES);
  } finally {
    global.window = was.window;
    global.chrome = was.chrome;
  }
});

test("until one is picked: US dollars, whatever the browser's language", async () => {
  const { shownCurrency } = await currency();
  assert.equal(shownCurrency(''), 'USD');
  assert.equal(shownCurrency(undefined), 'USD');
  assert.equal(shownCurrency('XYZ'), 'USD');
  assert.equal(shownCurrency('EUR'), 'EUR', 'a pick wins');
  assert.equal(shownCurrency('GBP'), 'GBP');
  // The policy: rates only if you pick a currency other than USD, so nothing in the
  // popup's currency reads the browser's language to choose one.
  const src = fs.readFileSync(path.join(ROOT, 'ui/popup/currency.js'), 'utf8');
  assert.doesNotMatch(src, /navigator|Intl\.Locale/);
});

test('no rates are asked for USD; another currency asks lib.js, which asks once a day', async () => {
  const { loadRates } = await currency();
  let asks = 0;
  const getFxRates = async () => (asks++, { date: '2026-10-14', rates: { USD: 1, EUR: 0.9 } });
  assert.equal(await loadRates('USD', getFxRates), null);
  assert.equal(await loadRates('XYZ', getFxRates), null);
  assert.equal(asks, 0, 'nothing asked for USD');
  assert.equal((await loadRates('EUR', getFxRates)).rates.EUR, 0.9);
  assert.equal(asks, 1);
  assert.equal(await loadRates('EUR', async () => Promise.reject(new Error('x'))), null);
  // The popup asks only through OH.getFxRates (at most once a day: test/value.test.js).
  const src = ['Popup.svelte', 'currency.js']
    .map((f) => fs.readFileSync(path.join(ROOT, 'ui/popup', f), 'utf8'))
    .join('\n');
  assert.doesNotMatch(src, /\bfetch\(|https:\/\/openhangar\.space\/rates/);
});

test('amounts: converted, the dollar figure on hover; dollars with no hover', async () => {
  const { money, fxFor, USD } = await currency();
  const rates = { date: '2026-10-14', rates: { USD: 1, EUR: 0.5, JPY: 150 } };
  assert.deepEqual(fxFor('EUR', rates), { code: 'EUR', rate: 0.5, date: '2026-10-14' });
  assert.equal(fxFor('USD', rates), USD);
  assert.equal(fxFor('GBP', rates), USD, 'no rate yet: dollars');
  assert.equal(fxFor('EUR', null), USD);
  const usd = money(1234.5, USD);
  assert.equal(usd.title, '');
  assert.match(usd.text, /^\$1,23[45]$/);
  const eur = money(1234.5, fxFor('EUR', rates));
  assert.match(eur.text, /€/);
  assert.match(eur.text, /617/);
  assert.match(eur.title, /^\$1,23[45]$/);
  const credit = money(42.5, fxFor('EUR', rates), { cents: true });
  assert.match(credit.text, /21[.,]25/);
  assert.equal(credit.title, '$42.50');
  const yen = money(42.5, fxFor('JPY', rates), { cents: true });
  assert.match(yen.text, /6,375/);
  assert.doesNotMatch(yen.text, /6,375[.,]\d/, 'no cents in yen');
  assert.deepEqual(money(null, USD), { text: '', title: '' });
});

// --- RSI's sign-in cookie ------------------------------------------------------------
// A cookie whose every field throws when read: the check may only see that it's there.
const untouchable = () =>
  new Proxy(
    {},
    {
      get(_, k) {
        if (k === 'then') return undefined; // not a promise
        throw new Error(`read the cookie's ${String(k)}`);
      },
      has() {
        throw new Error('looked inside the cookie');
      },
      ownKeys() {
        throw new Error('listed the cookie');
      },
    },
  );

test("the sign-in check: RSI's session cookie, whether it's there, never its value", async () => {
  const { rsiCookie, cookieName } = await cookie();
  assert.equal(cookieName(), 'Rsi-Token');
  const rules = require('../src/data/parser-rules.json');
  assert.equal(rules.cart.cookie, 'Rsi-Token', 'the parser rules name it');
  const asked = [];
  const api = (answer) => ({
    get: async (q) => (asked.push(q), answer()),
    getAll: async () => assert.fail('never every cookie'),
    set: async () => assert.fail('never sets one'),
    remove: async () => assert.fail('never removes one'),
  });
  assert.equal(await rsiCookie(api(untouchable)), 'in');
  assert.equal(await rsiCookie(api(() => null)), 'out');
  assert.equal(await rsiCookie(api(() => Promise.reject(new Error('x')))), null);
  assert.deepEqual(asked, [
    { url: 'https://robertsspaceindustries.com', name: 'Rsi-Token' },
    { url: 'https://robertsspaceindustries.com', name: 'Rsi-Token' },
    { url: 'https://robertsspaceindustries.com', name: 'Rsi-Token' },
  ]);
  // No cookies API, or no access to RSI (Firefox's add-ons page): it can't tell, and
  // doesn't ask.
  assert.equal(await rsiCookie(undefined), null);
  assert.equal(await rsiCookie(api(untouchable), { access: false }), null);
  assert.equal(asked.length, 3);
  // The name from the parser rules, when they're loaded.
  globalThis.OHRules = { cart: { cookie: 'Other-Name' } };
  try {
    await rsiCookie(api(() => null));
    assert.equal(asked.at(-1).name, 'Other-Name');
  } finally {
    delete globalThis.OHRules;
  }
});

test('signed out: greyed Scan while the cookie is gone, Scan again once it is back', async () => {
  const { rsiSignIn } = await cookie();
  const T = 1e12;
  // Nothing said signed out.
  assert.equal(rsiSignIn({ cookie: 'in' }), 'in');
  assert.equal(rsiSignIn({ cookie: null }), 'in');
  // The cookie's gone: signed out for sure, whatever the last scan said.
  assert.equal(rsiSignIn({ cookie: 'out' }), 'out');
  assert.equal(rsiSignIn({ cookie: 'out', readOut: T }), 'out');
  // The last scan said signed out: the cookie back since a popup saw it gone, signed in.
  assert.equal(rsiSignIn({ cookie: 'in', readOut: T, goneAt: T + 1 }), 'in');
  // ... but a cookie never seen gone, or gone before that scan, can't say: Log In to RSI
  // with a grey Scan still there to press.
  assert.equal(rsiSignIn({ cookie: 'in', readOut: T }), 'maybe');
  assert.equal(rsiSignIn({ cookie: 'in', readOut: T, goneAt: T - 1 }), 'maybe');
  assert.equal(rsiSignIn({ cookie: null, readOut: T }), 'maybe');
});

test('watching: any cookie change asks again once, and never reads what changed', async () => {
  const { watchCookie } = await cookie();
  const listeners = new Set();
  const api = {
    onChanged: {
      addListener: (f) => listeners.add(f),
      removeListener: (f) => listeners.delete(f),
    },
  };
  let checks = 0;
  const stop = watchCookie(() => checks++, api, 5);
  assert.equal(listeners.size, 1);
  for (const f of listeners) for (let i = 0; i < 5; i++) f(untouchable());
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(checks, 1, 'once for a burst');
  stop();
  assert.equal(listeners.size, 0);
  assert.equal(typeof watchCookie(() => {}, undefined), 'function', 'no API: nothing to stop');
});

// The words file's check: nothing else uses the cookies permission, and the sign-in
// check looks at no cookie but RSI's sign-in cookie.
test('who uses the cookies API: Log Out of RSI, Add to RSI Cart and the sign-in check', () => {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|svelte)$/.test(e.name)) files.push(p.replace(/\\/g, '/'));
    }
  };
  for (const f of fs.readdirSync(path.join(ROOT, 'src')))
    if (/\.js$/.test(f)) files.push(`src/${f}`);
  walk('ui');
  const users = files.filter((f) =>
    /\bchrome\??\.cookies\b|\bcookies\??\.(get|getAll|set|remove|onChanged)\b/.test(
      fs.readFileSync(path.join(ROOT, f), 'utf8'),
    ),
  );
  assert.deepEqual(users.sort(), [
    'src/lib.js', // OH.logout: Log Out of RSI
    'src/rsi-cart.js', // Add to RSI Cart (#651)
    'ui/popup/Popup.svelte', // hands chrome.cookies to the sign-in check
    'ui/popup/rsi-cookie.js', // the sign-in check
  ]);
  const popup = fs.readFileSync(path.join(ROOT, 'ui/popup/Popup.svelte'), 'utf8');
  assert.deepEqual(
    [...popup.matchAll(/chrome\.cookies(\.\w+)?/g)].map((m) => m[0]),
    ['chrome.cookies', 'chrome.cookies'],
    'the popup only hands it on',
  );
  const check = fs.readFileSync(path.join(ROOT, 'ui/popup/rsi-cookie.js'), 'utf8');
  assert.deepEqual([...check.matchAll(/api(?:\.|\?\.)(\w+)/g)].map((m) => m[1]).sort(), [
    'get',
    'get',
    'onChanged',
  ]);
  assert.doesNotMatch(check, /\.value\b/, 'never the value');
});

// --- Exports ---------------------------------------------------------------------------

test('JSON Backup, Pledges CSV and Buy-Backs CSV save what this browser keeps', async () => {
  const saved = [];
  const was = {
    document: global.document,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
    OH: globalThis.OH,
  };
  global.document = {
    createElement: () => {
      const a = { click() {}, remove() {} };
      return a;
    },
    body: { appendChild: (a) => saved.push({ name: a.download }) },
  };
  URL.createObjectURL = (blob) => {
    saved.push({ blob });
    return 'blob:x';
  };
  URL.revokeObjectURL = () => {};
  const db = {
    owner: { nickname: 'Test_Pilot' },
    sources: {
      hangar: { items: [{ id: '1', name: 'Gladius', kind: 'ship', value: 90, contents: [] }] },
      buybacks: {
        items: [
          { id: '7', name: 'Cutlass Black', kind: 'ship', date: 'Jan 5, 2025', contains: 'x' },
          { id: '8', name: 'Ghost Paint', kind: 'paint', date: 'Jan 6, 2025', contains: '' },
        ],
      },
    },
  };
  globalThis.OH = {
    loadDB: async () => db,
    getBuybackDetails: async () => ({ 7: { price: 110, insurance: 'LTI' } }),
    exportDB: async () => ({ account: { handle: 'Test_Pilot' }, sources: {} }),
  };
  try {
    const A = await import('../ui/popup/actions.js');
    assert.equal(await A.exportPledgesCsv(), 1);
    assert.equal(await A.exportBuybacksCsv(), 2);
    await A.exportJson();
    const blobs = saved.filter((s) => s.blob).map((s) => s.blob);
    const names = saved.filter((s) => s.name).map((s) => s.name);
    assert.deepEqual(
      blobs.map((b) => b.type),
      ['text/csv', 'text/csv', 'application/json'],
    );
    assert.match(names[0], /^open-hangar-pledges-Test_Pilot-\d{4}-\d\d-\d\d\.csv$/);
    assert.match(names[1], /^open-hangar-buybacks-Test_Pilot-\d{4}-\d\d-\d\d\.csv$/);
    assert.match(names[2], /^open-hangar-backup-Test_Pilot-\d{4}-\d\d-\d\d\.json$/);
    const bb = await blobs[1].text();
    assert.equal(bb.split('\r\n')[0], 'id,name,type,date,contains,insurance,price');
    assert.match(bb, /^7,Cutlass Black,ship,"Jan 5, 2025",x,LTI,110$/m, 'its page’s price');
    assert.match(bb, /^8,Ghost Paint,paint,"Jan 6, 2025",,,$/m);
  } finally {
    global.document = was.document;
    URL.createObjectURL = was.create;
    URL.revokeObjectURL = was.revoke;
    globalThis.OH = was.OH;
  }
});
