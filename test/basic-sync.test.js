'use strict';
// When a scan's page may sync (ui/scan/sync-timing.js): never while a scan runs, here
// or in another Open Hangar page; a sync asked for then waits for the scan's own sync at
// its end, and one the website's pace held back is tried once more (#658). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

const timing = () => import('../ui/scan/sync-timing.js');

test('another tab scanning: only a fresh mark from a different tab counts', async () => {
  const { scanElsewhere, SCAN_RUN_MAX } = await timing();
  const now = 1_000_000_000;
  assert.equal(scanElsewhere(null, 5, now), false, 'no mark, no scan');
  assert.equal(scanElsewhere({ at: now - 1000, tabId: 5 }, 5, now), false, 'this tab');
  assert.equal(scanElsewhere({ at: now - 1000, tabId: 9 }, 5, now), true, 'another tab');
  assert.equal(scanElsewhere({ at: now - SCAN_RUN_MAX, tabId: 9 }, 5, now), false, 'stale');
  assert.equal(scanElsewhere({ at: now - 1000 }, 5, now), true, 'no tab id: assume another');
  assert.equal(scanElsewhere({ at: 'x', tabId: 9 }, 5, now), false, 'a broken mark');
  // The same, asked as { tabId, run } (ui/scan/runner.js) about a mark without a run.
  assert.equal(scanElsewhere({ at: now - 1000, tabId: 5 }, { tabId: 5, run: 'a' }, now), false);
  assert.equal(scanElsewhere({ at: now - 1000, tabId: 9 }, { tabId: 5, run: 'a' }, now), true);
  assert.equal(scanElsewhere({ at: now - 1000 }, { tabId: 5, run: 'a' }, now), true);
});

test("a mark with a run id: this run's own, wherever it runs", async () => {
  const { scanElsewhere } = await timing();
  const now = 1_000_000_000;
  // A hidden page has no tab: its mark is its own, never another tab's scan.
  const hidden = { at: now - 1000, tabId: null, run: 'r1', by: 'offscreen' };
  assert.equal(scanElsewhere(hidden, { tabId: null, run: 'r1' }, now), false, 'its own run');
  assert.equal(scanElsewhere(hidden, { tabId: 5, run: 'r2' }, now), true, 'another page');
  assert.equal(scanElsewhere(hidden, { tabId: null, run: 'r2' }, now), true, 'another hidden page');
  // A tab's mark: another run in another tab counts; this tab's earlier page (reloaded
  // mid-scan) doesn't, as before.
  const tab = { at: now - 1000, tabId: 7, run: 'r3', by: 'tab' };
  assert.equal(scanElsewhere(tab, { tabId: 7, run: 'r3' }, now), false, 'this run');
  assert.equal(scanElsewhere(tab, { tabId: 8, run: 'r4' }, now), true, 'another tab');
  assert.equal(scanElsewhere(tab, { tabId: 7, run: 'r4' }, now), false, 'this tab, reloaded');
  assert.equal(scanElsewhere({ ...tab, at: now - 11 * 60e3 }, { run: 'r4' }, now), false, 'stale');
  // An older caller with a tab id only: keyed on the tab, as before.
  assert.equal(scanElsewhere(hidden, 5, now), true);
  assert.equal(scanElsewhere(tab, 7, now), false);
});

test('a sync during a scan waits for the scan; the scan’s own sync goes now', async () => {
  const { syncWhen } = await timing();
  assert.equal(syncWhen(), 'now');
  assert.equal(syncWhen({ busyHere: true }), 'after-scan');
  assert.equal(syncWhen({ busyHere: true, scanDone: true }), 'now');
  assert.equal(syncWhen({ elsewhere: true }), 'after-scan');
  assert.equal(syncWhen({ elsewhere: true, scanDone: true }), 'after-scan', 'not ours');
});

test('after a scan: a linked account syncs once; a press stays a press', async () => {
  const { afterScan } = await timing();
  assert.equal(afterScan({ linked: false, signedOut: false, kept: null }), null);
  assert.deepEqual(afterScan({ linked: true, signedOut: false, kept: null }), { auto: true });
  assert.equal(afterScan({ linked: true, signedOut: true, kept: null }), null, 'signed out');
  assert.deepEqual(afterScan({ linked: true, signedOut: false, kept: { auto: false } }), {
    auto: false,
  });
  // Connect pressed mid-scan, then signed out: the kept sync still goes (the last
  // whole hangar), as the press asked.
  assert.deepEqual(afterScan({ linked: true, signedOut: true, kept: { auto: true } }), {
    auto: true,
  });
});

test('a held-back sync is tried again only once no wait holds it', async () => {
  const { retryDue } = await timing();
  assert.equal(retryDue(null, null), false);
  assert.equal(retryDue({ at: 1 }, { reason: 'too-soon' }), false);
  assert.equal(retryDue({ at: 1 }, null), true);
});
