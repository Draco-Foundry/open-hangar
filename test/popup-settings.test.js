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

test('signed out: the cookie never locks Scan, and with the cookie there it is Scan', async () => {
  const { rsiSignIn } = await cookie();
  const T = 1e12;
  // Nothing said signed out.
  assert.equal(rsiSignIn({ cookie: 'in' }), 'in');
  assert.equal(rsiSignIn({ cookie: null }), 'in');
  // The cookie there: Scan, even after a scan that said signed out (RSI keeps the same
  // cookie through a sign-in, so a signed-in player was stuck on Log In to RSI, 0.5.0).
  assert.equal(rsiSignIn({ cookie: 'in', readOut: T }), 'in');
  // The cookie gone, or no answer after a signed-out scan: Log In to RSI first, with a
  // grey Scan still there to press. Never a Scan that's off.
  assert.equal(rsiSignIn({ cookie: 'out' }), 'maybe');
  assert.equal(rsiSignIn({ cookie: 'out', readOut: T }), 'maybe');
  assert.equal(rsiSignIn({ cookie: null, readOut: T }), 'maybe');
  // The scan this popup just reported said signed out: Log In to RSI, cookie or not, so
  // the scan never ends with nothing on screen (Firefox 0.5.1, 2026-10-20).
  assert.equal(rsiSignIn({ cookie: 'in', readOut: T, justOut: true }), 'maybe');
  assert.equal(rsiSignIn({ cookie: null, justOut: true }), 'maybe');
  const popup = fs.readFileSync(path.join(ROOT, 'ui/popup/Popup.svelte'), 'utf8');
  assert.match(popup, /justOut: shown\?\.signedOut === true/, 'the popup passes its report');
  const bar = fs.readFileSync(path.join(ROOT, 'ui/popup/ScanBar.svelte'), 'utf8');
  // The cookie never locks Scan. The one Scan that's ever off is the main one (alone, or
  // small beside a note), while a scan starts or RSI asks to wait (the scanBar flag, the
  // owner 2026-10-20).
  assert.doesNotMatch(
    bar,
    /class="pp-btn grey[^"]*" id="pp-scan"[^>]*disabled/,
    'Scan is never switched off',
  );
  const offs = [...bar.matchAll(/id="pp-scan"[^>]*disabled={([^}]*)}/g)].map((m) => m[1]);
  assert.deepEqual(offs, ['scanOff', 'scanOff'], 'only the main Scan, only for scanOff');
  assert.doesNotMatch(bar, /scanOff = [^;]*(signedOut|cookie|signIn)/, 'never for the cookie');
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
    // Auto Scan Daily's sign-in check (the autoScanRun flag: cut from every store build,
    // test/auto-scan.test.js check 6): the worker tells the hidden scan page whether the
    // sign-in cookie is there, through the page's stand-in on Chrome and Edge.
    'src/scan-host.js',
    'src/scan-shim.js',
    'ui/popup/Popup.svelte', // hands chrome.cookies to the sign-in check
    'ui/popup/rsi-cookie.js', // the sign-in check
    'ui/scan/main.js', // hands chrome.cookies to the same check, for Auto Scan Daily
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
  // The hidden scan page's cookies API is Auto Scan Daily's alone: cut from a build without
  // the autoScanRun flag (src/), handed on only with it (ui/scan/main.js).
  const { cutFlags } = require('./bridge-env.js');
  for (const f of ['src/scan-host.js', 'src/scan-shim.js'])
    assert.doesNotMatch(
      cutFlags(fs.readFileSync(path.join(ROOT, f), 'utf8'), { autoScan: true }),
      /'cookies\.get'|chrome\.cookies\.get|c\.cookies =/,
      f,
    );
  const page = fs.readFileSync(path.join(ROOT, 'ui/scan/main.js'), 'utf8');
  assert.deepEqual(
    [...page.matchAll(/^.*chrome\.cookies.*$/gm)].map((m) => m[0].trim()),
    ["rsiCookie: flag('autoScanRun') ? () => rsiCookie(chrome.cookies) : undefined,"],
  );
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

// --- Notifications ---------------------------------------------------------------------

// The ask is the click's first step everywhere; on Firefox the popup then closes, since
// Firefox's question sits under it (#694). Chrome and Edge keep the popup open.
test('Notifications: asked first, and only Firefox closes the popup for the question', async () => {
  const was = { chrome: global.chrome, window: global.window };
  const A = await import('../ui/popup/actions.js');
  const run = async (gecko) => {
    const steps = [];
    global.chrome = {
      runtime: { getManifest: () => (gecko ? { browser_specific_settings: { gecko } } : {}) },
      permissions: {
        request: async (p) => (steps.push('ask:' + p.permissions.join()), true),
      },
    };
    global.window = { close: () => steps.push('close') };
    const asked = A.askNotify();
    steps.push('returned');
    assert.equal(await asked, true);
    await new Promise((r) => setTimeout(r, 5));
    return steps;
  };
  try {
    assert.deepEqual(await run({ id: 'x' }), ['ask:notifications', 'returned', 'close']);
    assert.deepEqual(await run(null), ['ask:notifications', 'returned']);
    // Already allowed (the reminder's switch, with Notifications on): no question, so the
    // popup stays open, on Firefox too.
    const steps = [];
    global.chrome = {
      runtime: { getManifest: () => ({ browser_specific_settings: { gecko: { id: 'x' } } }) },
      permissions: { request: async () => (steps.push('ask'), true) },
    };
    global.window = { close: () => steps.push('close') };
    assert.equal(await A.askNotify(true), true);
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(steps, []);
  } finally {
    global.chrome = was.chrome;
    global.window = was.window;
  }
});
