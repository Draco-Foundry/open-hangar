'use strict';
// A buy-back's own RSI page, read as the pilot opens it on our pages (bridge v2
// oh-read-buyback, src/background.js): the worker's side, in the sandbox of
// test/bridge-env.js, with the hidden scan page stood in for (it answers in session
// bbRead, as ui/scan/runner.js readBuyback does; that side is test/scan-runner.test.js).
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { APP, FRONT, HANGAR, loadBackground } = require('./bridge-env.js');
const { states } = require('./stored-data.js');

const ASK = (pledgeId = 70000002) => ({ type: 'oh-read-buyback', pledgeId });
const CCU = {
  id: '70000009',
  name: 'Upgrade - Mustang to Cutlass',
  date: 'Jan 05, 2025',
  contains: 'Upgrade',
  href: '',
  price: '',
  isCCU: true,
  ccu: { from: 'Mustang', to: 'Cutlass' },
  wasUpgraded: false,
  fromShipId: '',
  toShipId: '',
  toSkuId: '',
  kind: 'ccu',
};
const PAGE = { price: 45, currency: 'USD', insurance: 'LTI', ships: [{ name: 'Mustang Alpha' }] };
// The store build's worker with a scanned hangar of two buy-backs (none read) and an
// upgrade, an offscreen document for the hidden page.
function worker(o = {}) {
  const mem = structuredClone(states()[1].mem);
  mem.db.sources.buybacks.items.push(CCU);
  const x = loadBackground({ changes: true, offscreen: true, ...o, local: { ...mem, ...o.local } });
  // The hidden page, stood in for: once it's asked, `page(detail)` saves the detail (or
  // nothing) and answers.
  x.page = async (detail, answer = { ok: !!detail }) => {
    const id = x.stores.session.scanRequest.buyback;
    if (detail)
      await x.chrome.storage.local.set({
        bbDetails: { ...x.stores.local.bbDetails, [id]: detail },
      });
    await x.chrome.storage.session.set({ bbRead: { id, at: Date.now(), ...answer } });
  };
  return x;
}
async function until(ok, ms = 1500) {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 2));
  }
}

test('opened: its page read in the hidden page, never a tab, and the row handed back', async () => {
  const x = worker();
  const asked = x.send(ASK(), APP);
  await until(() => x.docs.length === 1);
  assert.match(x.docs[0].url, /^src\/scan\.html\?run=[\w-]+&by=offscreen&v=/);
  const r = x.stores.session.scanRequest;
  assert.equal(r.reason, 'buyback');
  assert.equal(r.buyback, '70000002');
  await x.page(PAGE);
  const a = await asked;
  assert.equal(a.ok, true);
  assert.equal(a.read, true);
  assert.equal(a.buyback.id, '70000002');
  assert.equal(a.buyback.price, '$45.00 USD');
  assert.equal(a.buyback.priceFrom, 'page');
  assert.equal(a.buyback.insurance, 'LTI');
  assert.deepEqual(x.opened, [], 'no tab');
  // Opened again: read before, so nothing is asked of the page.
  const again = await x.send(ASK(), HANGAR);
  assert.equal(again.ok, true);
  assert.equal(again.read, false);
  assert.equal(again.buyback.priceFrom, 'page');
  assert.equal(x.stores.session.scanRequest?.reason === 'buyback' && x.docs.length > 1, false);
});

test('not read: an upgrade, an unknown pledge, a scan running, or RSI not giving it', async () => {
  const x = worker();
  assert.deepEqual(await x.send(ASK(70000009), APP), { ok: false, error: 'no-page' });
  assert.deepEqual(await x.send(ASK(123), FRONT), { ok: false, error: 'not-found' });
  assert.equal(x.docs.length, 0, 'nothing asked of RSI for those');
  // A scan asked for a moment ago: busy.
  const y = worker({ session: { scanRequest: { at: Date.now(), tabId: null, reason: 'popup' } } });
  assert.deepEqual(await y.send(ASK(), APP), { ok: false, error: 'busy' });
  // RSI didn't give the page (signed out, a slow-down): not read.
  const z = worker();
  const asked = z.send(ASK(), APP);
  await until(() => z.docs.length === 1);
  await z.page(null, { ok: false, error: 'not-read' });
  assert.deepEqual(await asked, { ok: false, error: 'not-read' });
  // Nothing scanned in this browser: the scan's own answer.
  const none = worker({ local: { db: undefined } });
  assert.deepEqual(await none.send(ASK(), APP), { ok: false, error: 'no-scan' });
});

test('one at a time: a second buy-back opened while one is read is busy', async () => {
  const x = worker();
  const first = x.send(ASK(), APP);
  await until(() => x.docs.length === 1);
  assert.deepEqual(await x.send(ASK(70000001), APP), { ok: false, error: 'busy' });
  await x.page(PAGE);
  assert.equal((await first).ok, true);
});

test('Firefox: its data yes first, as for the hangar; no hidden page, no tab', async () => {
  const f = worker({ browser: 'firefox', granted: false, offscreen: false, frames: true });
  assert.deepEqual(await f.fromPage(ASK(), `${APP}/hangar`), { ok: false, error: 'firefox-ask' });
  assert.deepEqual(f.opened, []);
  // A browser with no hidden page at all: never a tab for it.
  const t = worker({ offscreen: false });
  assert.deepEqual(await t.send(ASK(), APP), { ok: false, error: 'no-hidden' });
  assert.deepEqual(t.opened, []);
});
