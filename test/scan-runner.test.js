'use strict';
// The scan runner (ui/scan/runner.js): the scan any page runs, with a stand-in OH
// (src/lib.js) and storage. Its order, the report and progress it stores, the marks
// that say a scan runs (keyed on its run), the sync kept for the scan's end, the try
// more after the website's pace, the pack reads and the RSI portrait. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../ui/scan/runner.js');

// A storage area in memory, every write noted.
function area(data = {}) {
  const writes = [];
  const keys = (k) => (k == null ? Object.keys(data) : [].concat(k));
  return {
    data,
    writes,
    get: async (k) =>
      Object.fromEntries(
        keys(k)
          .filter((x) => x in data)
          .map((x) => [x, structuredClone(data[x])]),
      ),
    set: async (o) => {
      writes.push(structuredClone(o));
      Object.assign(data, structuredClone(o));
    },
    remove: async (k) => {
      for (const x of [].concat(k)) {
        writes.push({ removed: x });
        delete data[x];
      }
    },
  };
}
const sets = (a, key) => a.writes.filter((w) => key in w).map((w) => w[key]);
const removals = (a, key) => a.writes.filter((w) => w.removed === key).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ACCOUNT = {
  loggedIn: true,
  nickname: 'Test_Pilot',
  displayname: 'Test Pilot',
  avatar: 'https://robertsspaceindustries.com/media/abc123/heap_infobox/avatar.png',
};
const pack = (i) => ({ id: String(700 + i), name: `Pack ${i}`, kind: 'pack', isCCU: false });

// A stand-in OH with a hangar of two pledges, buy-backs with three packs never read, a
// clock (`clock.t`) and every call noted in order.
function setup(opts = {}) {
  const calls = [];
  const logs = [];
  const clock = { t: 1_000_000 };
  const local = area({ ...(opts.local || {}) });
  const session = opts.session === null ? null : area({ ...(opts.session || {}) });
  let db = {
    owner: { nickname: 'Test_Pilot' },
    sources: {
      hangar: { items: [{ id: '1' }, { id: '2' }], scannedAt: 1 },
      buybacks: { items: [pack(1), pack(2), pack(3), { id: '9', kind: 'ship' }], scannedAt: 1 },
    },
    history: [],
    ...(opts.db || {}),
  };
  const details = { 701: { price: 10 } };
  const OH = {
    flags: { wishlistImport: false, ...(opts.flags || {}) },
    log: (level, where, msg) => logs.push(`${level} ${where}: ${msg}`),
    getAccount: async ({ force } = {}) => {
      calls.push(`getAccount${force ? ' force' : ''}`);
      return opts.account === undefined ? ACCOUNT : opts.account;
    },
    loadDB: async () => {
      calls.push('loadDB');
      return structuredClone(db);
    },
    switchProfile: async (nickname) => {
      calls.push(`switchProfile ${nickname}`);
      db = { ...db, owner: { nickname } };
      return { restored: false };
    },
    scanSource:
      opts.scanSource ||
      (async (id, onProgress) => {
        calls.push(`scanSource ${id}`);
        onProgress(1, 2);
        return id === 'hangar'
          ? { ok: true, items: [{ id: '1' }, { id: '2' }] }
          : { ok: true, items: db.sources.buybacks.items };
      }),
    getReferral: async (onProgress) => {
      calls.push('getReferral');
      onProgress('recruits', 3);
      return { ok: true, partial: null };
    },
    getHistory: async () => [],
    fillBuybackDetailsFromHistory: async (list) => calls.push(`fill ${list.length}`),
    getBuybackDetails: async () => details,
    fetchBuybackDetails:
      opts.fetchBuybackDetails ||
      (async (ids, onProgress) => {
        calls.push(`fetchBuybackDetails ${ids.join(',')}`);
        ids.forEach((id, i) => onProgress(i + 1, ids.length));
        return { done: ids.length, errors: 0, total: ids.length };
      }),
    flushBuybackDetails: async () => calls.push('flush'),
    storageSettled: async () => calls.push('settled'),
    siteEnabled: async () => opts.linked !== false,
    getSiteLink: async () => (opts.linked === false ? null : local.data.siteLink || null),
    siteSyncWait: (link, { now = clock.t } = {}) =>
      link?.wait && link.wait.until > now ? link.wait : null,
    siteSync:
      opts.siteSync ||
      (async ({ auto }) => {
        calls.push(`siteSync ${auto ? 'auto' : 'press'}`);
      }),
    siteUrl: async () => 'https://app.openhangar.space',
  };
  if (opts.linked !== false && !local.data.siteLink)
    local.data.siteLink = { token: 't', name: 'pilot', connectedAt: 1 };
  const seen = [];
  return load().then(({ createRunner }) => {
    const runner = createRunner({
      OH,
      store: local,
      session,
      me: { by: opts.by || 'tab', tabId: opts.tabId === undefined ? 42 : opts.tabId, run: 'run-a' },
      mayReadRsi: async () => opts.rsi !== false,
      mayShare: async () => opts.share !== false,
      now: () => clock.t,
      fetchFn: opts.fetchFn || (async () => assert.fail('no network in this test')),
      appVersion: '0.3.1',
      hooks: {
        start: () => seen.push('start'),
        progress: (p) => seen.push(`progress ${p.part}`),
        account: (a, switched) => seen.push(`account ${switched ? switched.who : '-'}`),
        scanned: (report) => seen.push(`scanned ${report.rows.length}`),
        syncStart: () => seen.push('syncStart'),
        synced: (r) => seen.push(`synced ${r.state}`),
        packs: () => seen.push('packs'),
      },
      ...(opts.env || {}),
    });
    return { runner, OH, local, session, calls, logs, clock, seen };
  });
}

test('scan: the account, the hangar, buy-backs, referrals, saved, then the sync and packs', async () => {
  const x = await setup();
  const report = await x.runner.scan({ reason: 'popup' });
  await x.runner.readPacks(); // the one the scan started
  assert.deepEqual(x.calls, [
    'getAccount force',
    'loadDB', // whose hangar is live (reconcile)
    'scanSource hangar',
    'scanSource buybacks',
    'getReferral',
    'loadDB',
    'fill 4',
    'flush',
    'settled',
    'siteSync auto',
    'fetchBuybackDetails 702,703', // packs never read (701 was), not the ship
    'flush',
    'settled',
  ]);
  assert.deepEqual(x.seen.slice(0, 3), ['start', 'progress start', 'progress account']);
  assert.ok(
    x.seen.indexOf('scanned 3') < x.seen.indexOf('syncStart'),
    'the report before the sync',
  );
  assert.ok(x.seen.includes('synced sent') && x.seen.at(-1) === 'packs');
  // The report: ids and counts, never words.
  assert.deepEqual(Object.keys(report), [
    'v',
    'run',
    'by',
    'reason',
    'startedAt',
    'at',
    'ms',
    'held',
    'signedOut',
    'switched',
    'rows',
    'bad',
    'sync',
  ]);
  assert.equal(report.v, 1);
  assert.equal(report.run, 'run-a');
  assert.equal(report.by, 'tab');
  assert.equal(report.reason, 'popup');
  assert.equal(report.held, null);
  assert.equal(report.signedOut, false);
  assert.equal(report.switched, null);
  assert.deepEqual(report.rows, [
    { id: 'hangar', ok: true, partial: null, n: 2, error: null },
    { id: 'buybacks', ok: true, partial: null, n: 4, error: null },
    { id: 'referrals', ok: true, partial: null, n: null, error: null },
  ]);
  assert.equal(report.bad, false);
  assert.deepEqual(report.sync, { state: 'sent', msg: null, at: x.clock.t });
  // Stored as it is (local scanReport): first without the sync, then with it.
  const stored = sets(x.local, 'scanReport');
  assert.equal(stored.length, 2);
  assert.equal(stored[0].sync, null);
  assert.deepEqual(stored[1], report);
  assert.deepEqual(x.local.data.scanReport, report);
});

test('scan: its marks (run and by), its heartbeat every 30 seconds at most, gone at the end', async () => {
  const x = await setup({
    scanSource: async function (id, onProgress) {
      // RSI pages, 20 seconds apart.
      for (let page = 1; page <= 4; page++) {
        onProgress(page, page * 10);
        x.clock.t += 20e3;
      }
      return { ok: true, items: [] };
    },
  });
  await x.runner.scan();
  const marks = sets(x.session, 'scanRunning');
  assert.deepEqual(marks[0], { at: 1_000_000, tabId: 42, run: 'run-a', by: 'tab' });
  // 8 pages over 160 seconds: renewed every 30 seconds or so, not every page, and never
  // quiet for the 2 minutes that make it a scan that stopped.
  assert.ok(marks.length >= 4 && marks.length <= 6, `${marks.length} marks`);
  for (let i = 1; i < marks.length; i++) {
    assert.ok(marks[i].at - marks[i - 1].at >= (await load()).MARK_GAP);
    assert.ok(marks[i].at - marks[i - 1].at < 2 * 60e3);
  }
  assert.equal(x.session.data.scanRunning, undefined, 'removed at the end');
  assert.equal(x.session.data.scanProgress, undefined, 'removed at the end');
  // A page that learns its tab late (a promise) still marks the tab it's in.
  const y = await setup({ tabId: Promise.resolve(7), by: 'tab' });
  await y.runner.scan();
  assert.equal(sets(y.session, 'scanRunning')[0].tabId, 7);
});

test('marked: settles once the scan has its mark stored, or once it is held', async () => {
  const x = await setup();
  // A slow session: the mark lands well after the scan has started.
  const set = x.session.set;
  let land;
  const slow = new Promise((r) => (land = r));
  x.session.set = async (o) => {
    if ('scanRunning' in o) await slow;
    return set(o);
  };
  const running = x.runner.scan();
  let settled = false;
  x.runner.marked().then(() => (settled = true));
  await sleep(10);
  assert.equal(settled, false, 'not before the mark is stored');
  land();
  await x.runner.marked();
  assert.equal(sets(x.session, 'scanRunning').length, 1);
  await running;
  // Held: settles once the held report is stored, with no mark.
  const off = await setup({ rsi: false });
  const held = off.runner.scan();
  await off.runner.marked();
  assert.equal(off.local.data.scanReport.held, 'no-rsi');
  assert.equal(sets(off.session, 'scanRunning').length, 0);
  await held;
  const other = { at: 1_000_000 - 5000, tabId: 9, run: 'run-b', by: 'tab' };
  const busy = await setup({ session: { scanRunning: other } });
  const waiting = busy.runner.scan();
  await busy.runner.marked();
  assert.equal(busy.local.data.scanReport.held, 'busy');
  assert.equal((await waiting).bad, false);
});

test('scan: progress stored about twice a second at most, the newest kept, gone at the end', async () => {
  const x = await setup({
    scanSource: async (id, onProgress) => {
      if (id !== 'hangar') {
        onProgress(1, 0);
        return { ok: true, items: [] };
      }
      for (let page = 1; page <= 11; page++) {
        onProgress(page, page * 10, page === 4 ? { attempt: 1, of: 3, extra: 'x' } : null);
        x.clock.t += 100;
      }
      return { ok: true, items: [] };
    },
  });
  await x.runner.scan();
  await x.runner.readPacks(); // the packs the scan went on to read
  const hangar = sets(x.session, 'scanProgress').filter((p) => p.part === 'hangar');
  // Pages at 0, 100 … 1000 ms: written at 0, 500 and 1000 ms only.
  assert.deepEqual(
    hangar.map((p) => p.page),
    [1, 6, 11],
  );
  assert.deepEqual(hangar[0], {
    run: 'run-a',
    at: 1_000_000,
    part: 'hangar',
    page: 1,
    count: 10,
    retry: null,
  });
  // The page's own line hears every one (hooks.progress is not throttled).
  assert.equal(x.seen.filter((s) => s === 'progress hangar').length, 11);
  // Each part's start is written right away.
  const parts = [...new Set(sets(x.session, 'scanProgress').map((p) => p.part))];
  assert.deepEqual(parts, ['start', 'account', 'hangar', 'buybacks', 'referrals', 'sync', 'packs']);
  assert.ok(removals(x.session, 'scanProgress') >= 1);
  assert.equal(x.session.data.scanProgress, undefined);

  // Progress that stops between writes still lands: the newest, a moment later.
  const { PROGRESS_GAP } = await load();
  const y = await setup({
    scanSource: async (id, onProgress) => {
      if (id === 'hangar') {
        onProgress(1, 10);
        onProgress(2, 20, { attempt: 2, of: 3 });
        await sleep(PROGRESS_GAP + 150);
      }
      return { ok: true, items: [] };
    },
  });
  await y.runner.scan();
  const late = sets(y.session, 'scanProgress').filter((p) => p.part === 'hangar');
  assert.deepEqual(
    late.map((p) => [p.page, p.retry]),
    [
      [1, null],
      [2, { attempt: 2, of: 3 }],
    ],
  );
});

test('scan: its progress goes even when the page throws after the report', async () => {
  const x = await setup({
    env: {
      hooks: {
        scanned: () => {
          throw new Error('the page broke');
        },
      },
    },
  });
  await assert.rejects(x.runner.scan(), /the page broke/);
  await sleep(10); // the queued removals
  assert.equal(x.local.data.scanReport.held, null, 'the report was stored first');
  assert.equal(x.session.data.scanProgress, undefined);
  assert.equal(x.session.data.scanRunning, undefined);
});

test('scan: held while another run scans, never by its own run; held without RSI access', async () => {
  const other = { at: 1_000_000 - 5000, tabId: null, run: 'run-b', by: 'offscreen' };
  const x = await setup({ session: { scanRunning: other } });
  assert.equal(await x.runner.otherScan(), true);
  const held = await x.runner.scan({ reason: 'page' });
  assert.equal(held.held, 'busy');
  assert.deepEqual(held.rows, []);
  assert.deepEqual(x.calls, [], 'nothing read');
  assert.equal(x.local.data.scanReport.held, 'busy');
  // Its own run's mark (a page without a tab) is never another page's scan.
  const own = await setup({ tabId: null, session: { scanRunning: { ...other, run: 'run-a' } } });
  assert.equal(await own.runner.otherScan(), false);
  assert.equal((await own.runner.scan()).held, null);
  // An older page's mark (no run) in another tab still counts.
  const old = await setup({ session: { scanRunning: { at: 1_000_000 - 5000, tabId: 9 } } });
  assert.equal(await old.runner.otherScan(), true);
  // No access to RSI: no scan that can only fail.
  const off = await setup({ rsi: false });
  const r = await off.runner.scan();
  assert.equal(r.held, 'no-rsi');
  assert.deepEqual(off.calls, []);
  assert.ok(off.logs.includes('info status: scan held: no access to robertsspaceindustries.com'));
  assert.equal(off.session.data.scanRunning, undefined, 'never marked');
  // A held scan never began: no start kept.
  assert.equal(x.local.data.scanStarted, undefined);
  assert.equal(off.local.data.scanStarted, undefined);
});

test('scan: its start is kept past a browser restart, and its report names the same run', async () => {
  // The session marks go when the browser closes (the hidden page with them); the start
  // stays, so a start with no report for its run is a scan that stopped (#665).
  const x = await setup({ by: 'offscreen', tabId: null });
  let seen = null;
  x.OH.scanSource = async (id) => {
    seen ??= structuredClone(x.local.data.scanStarted);
    return { ok: true, items: [] };
  };
  const report = await x.runner.scan({ reason: 'site' });
  assert.deepEqual(seen, { run: 'run-a', by: 'offscreen', reason: 'site', at: report.startedAt });
  assert.equal(seen.run, report.run, 'its report is the same run: it finished');
  assert.deepEqual(x.local.data.scanStarted, seen);
});

test('scan: one at a time in a page; signed out reads nothing and sends nothing', async () => {
  const x = await setup();
  const [a, b] = await Promise.all([x.runner.scan(), x.runner.scan()]);
  assert.ok(a && b === null, 'the second press while the first runs is no scan');
  const out = await setup({ account: { loggedIn: false } });
  const r = await out.runner.scan();
  assert.equal(r.signedOut, true);
  assert.deepEqual(r.rows, []);
  assert.equal(r.sync, null);
  assert.deepEqual(out.calls, ['getAccount force', 'flush', 'settled']);
  assert.ok(out.logs.includes('error status: signed out'));
});

test('scan: signed out partway, nothing more is read, and the report says signed out', async () => {
  const x = await setup();
  const read = [];
  x.OH.scanSource = async (id) => {
    read.push(id);
    return { ok: false, signedOut: true, error: 'not signed in' };
  };
  x.OH.getReferral = async () => (read.push('referral'), { ok: true });
  const r = await x.runner.scan();
  assert.deepEqual(read, ['hangar'], 'buy-backs and referrals never asked');
  assert.equal(r.signedOut, true);
  assert.equal(r.bad, true);
  assert.deepEqual(
    r.rows.map((row) => [row.id, row.ok]),
    [['hangar', false]],
  );
  assert.equal(r.sync?.state ?? null, null, 'nothing sent');
});

test('scan: a part that fails or stops short is a problem, logged without names', async () => {
  const x = await setup({
    linked: false,
    scanSource: async (id) =>
      id === 'hangar'
        ? { ok: true, items: [{}], partial: 'stopped at page 2 (timeout); rescan to get the rest' }
        : { ok: false, error: 'RSI changed something' },
  });
  const r = await x.runner.scan();
  assert.deepEqual(r.rows.slice(0, 2), [
    {
      id: 'hangar',
      ok: true,
      partial: 'stopped at page 2 (timeout); rescan to get the rest',
      n: 1,
      error: null,
    },
    { id: 'buybacks', ok: false, partial: null, n: null, error: 'RSI changed something' },
  ]);
  assert.equal(r.bad, true);
  assert.ok(x.logs.includes('error status: Hangar: problem · Buy-Backs: problem · Referrals: ok'));
  assert.deepEqual(r.sync, { state: 'off', msg: null, at: x.clock.t }, 'not connected');
  assert.ok(
    !x.calls.some((c) => c.startsWith('fetchBuybackDetails')),
    'no packs after a failed list',
  );
  // Every part paused by status.json: held as paused.
  const paused = await setup({
    scanSource: async () => ({ ok: false, paused: true, error: 'paused while we patch it' }),
    env: {},
  });
  paused.OH.getReferral = async () => ({ ok: false, paused: true, error: 'paused' });
  assert.equal((await paused.runner.scan()).held, 'paused');
});

test('scan: another RSI account signed in switches the hangar, said as ids', async () => {
  const x = await setup({ account: { ...ACCOUNT, nickname: 'Alt_Pilot', displayname: 'Alt' } });
  const r = await x.runner.scan();
  assert.deepEqual(r.switched, { who: 'Alt', restored: false });
  assert.ok(x.calls.includes('switchProfile Alt_Pilot'));
  assert.ok(x.seen.includes('account Alt'));
  // The same account: nothing to switch.
  assert.equal(await x.runner.reconcile(ACCOUNT, { owner: { nickname: 'test_pilot' } }), null);
  assert.equal(await x.runner.reconcile({ loggedIn: false }), null);
});

test('sync: one asked for during a scan is kept, then sent as a press at its end (#658)', async () => {
  let x;
  x = await setup({
    scanSource: async (id) => {
      if (id === 'hangar') {
        const kept = await x.runner.sync({ auto: false });
        assert.equal(kept.state, 'kept');
      }
      return { ok: true, items: [] };
    },
  });
  const r = await x.runner.scan();
  assert.deepEqual(
    x.calls.filter((c) => c.startsWith('siteSync')),
    ['siteSync press'],
    "one sync, the scan's own, as the press asked",
  );
  assert.equal(r.sync.state, 'sent');
  assert.equal(x.session.data.syncAfterScan, undefined, 'taken');
  assert.deepEqual(sets(x.session, 'syncAfterScan')[0], { at: 1_000_000, auto: false });
  // Signed out with nothing kept: no sync; with one kept, it goes (the stored hangar).
  const out = await setup({ account: { loggedIn: false } });
  await out.runner.scan();
  assert.ok(!out.calls.some((c) => c.startsWith('siteSync')));
  const asked = await setup({
    account: { loggedIn: false },
    session: { syncAfterScan: { at: 1, auto: true } },
  });
  assert.equal((await asked.runner.scan()).sync.state, 'sent');
  // Another page scanning: kept for that scan.
  const elsewhere = await setup({
    session: { scanRunning: { at: 1_000_000, tabId: 9, run: 'run-b', by: 'tab' } },
  });
  assert.equal((await elsewhere.runner.sync({ auto: true })).state, 'kept');
  assert.ok(!elsewhere.calls.some((c) => c.startsWith('siteSync')));
});

test("sync: a press near the scan's end never stops the scan's own sync", async () => {
  // The press is still keeping itself for the scan (a slow session) when the scan
  // reaches its own sync.
  let x;
  let press;
  x = await setup({
    scanSource: async (id) => {
      if (id === 'buybacks') press = x.runner.sync({ auto: false });
      return { ok: true, items: [] };
    },
  });
  const get = x.session.get;
  let land;
  const slow = new Promise((r) => (land = r));
  let first = true;
  x.session.get = async (k) => {
    if (k === 'syncAfterScan' && first) {
      first = false;
      await slow;
    }
    return get(k);
  };
  const r = await x.runner.scan();
  assert.equal(r.sync?.state, 'sent', "the scan's own sync went");
  assert.deepEqual(
    x.calls.filter((c) => c.startsWith('siteSync')),
    ['siteSync auto'],
  );
  land();
  assert.equal((await press).state, 'kept');
});

test("sync: Firefox's no, the website's answers, and the one try more after its pace", async () => {
  const no = await setup({ share: false });
  assert.deepEqual(await no.runner.sync(), { state: 'off', msg: null, at: 1_000_000 });
  assert.ok(!no.calls.some((c) => c.startsWith('siteSync')));
  assert.equal(await (await setup({ linked: false })).runner.sync(), null, 'not connected');
  // A too-soon refusal: calm, the website's words, and siteSyncAgain for one more try.
  const said = 'openhangar.space just took a sync for this account.';
  let x;
  x = await setup({
    siteSync: async ({ auto }) => {
      x.calls.push(`siteSync ${auto ? 'auto' : 'press'}`);
      if (x.local.data.siteLink.wait) throw Object.assign(new Error(said), { calm: true });
      x.local.data.siteLink.wait = { reason: 'too-soon', until: x.clock.t + 60e3, said };
      throw Object.assign(new Error(said), { calm: true });
    },
  });
  const r = await x.runner.sync({ auto: true });
  assert.deepEqual(r, { state: 'calm', msg: said, at: 1_000_000 });
  assert.deepEqual(x.local.data.siteSyncAgain, { at: 1_000_000, auto: true });
  assert.ok(x.logs.includes(`info site: ${said}`));
  // Still waiting: no try. Once the wait is over: one, and no new siteSyncAgain after it.
  assert.equal(await x.runner.retryIfDue(), null);
  x.clock.t += 61e3;
  const again = await x.runner.retryIfDue();
  assert.equal(again.state, 'calm');
  assert.equal(x.local.data.siteSyncAgain, undefined);
  assert.equal(x.calls.filter((c) => c === 'siteSync auto').length, 2);
  // A sync it held (a wait), an error, the pilot question, an account you said no to.
  const answers = [
    [Object.assign(new Error('held'), { calm: true, held: 'too-soon' }), 'held', 'held'],
    [new Error('openhangar.space responded 500'), 'error', 'openhangar.space responded 500'],
    [Object.assign(new Error('Sync X?'), { calm: true, ask: { handle: 'X' } }), 'ask', null],
    [Object.assign(new Error('Not synced'), { quiet: true }), 'quiet', null],
  ];
  for (const [err, state, msg] of answers) {
    const y = await setup({
      siteSync: async () => {
        throw err;
      },
    });
    const s = await y.runner.sync();
    assert.equal(s.state, state);
    assert.equal(s.msg, msg);
    if (state === 'ask') assert.deepEqual(s.ask, { handle: 'X' });
  }
});

test('readPacks: up to the cap, one read at a time, everything saved before it answers', async () => {
  let release;
  const x = await setup({
    fetchBuybackDetails: async (ids, onProgress) => {
      x.calls.push(`fetch ${ids.length}`);
      await new Promise((r) => (release = r));
      onProgress(ids.length, ids.length);
      return { done: ids.length, errors: 0, total: ids.length };
    },
  });
  const a = x.runner.readPacks({ max: 1 });
  const b = x.runner.readPacks();
  await sleep(10);
  release();
  const [ra, rb] = await Promise.all([a, b]);
  assert.deepEqual(ra, { todo: 1, done: 1, errors: 0 });
  assert.equal(rb, ra, "asked again while it reads: that read's answer");
  assert.deepEqual(x.calls.slice(-3), ['fetch 1', 'flush', 'settled']);
  assert.equal(x.session.data.scanProgress, undefined);
  // RSI asked to slow down: said so.
  const slow = await setup({
    fetchBuybackDetails: async () => ({ done: 0, errors: 0, rateLimited: true, retryAt: 5 }),
  });
  assert.deepEqual(await slow.runner.readPacks(), {
    todo: 2,
    done: 0,
    errors: 0,
    rateLimited: true,
    retryAt: 5,
  });
});

test('the portrait: a small copy of the RSI picture, read again only when it changes', async () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const asked = [];
  const fetchFn = async (url, init) => {
    asked.push({ url, init });
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  };
  const x = await setup({ fetchFn });
  await x.runner.scan();
  assert.equal(asked.length, 1);
  assert.equal(asked[0].url, ACCOUNT.avatar);
  assert.equal(asked[0].init.credentials, 'omit');
  assert.deepEqual(x.local.data.avatarImg, {
    nickname: 'Test_Pilot',
    src: `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
    at: 1_000_000,
    url: ACCOUNT.avatar,
  });
  // The same picture: not read again.
  await x.runner.scan();
  assert.equal(asked.length, 1);
  // Never from another host, never too big, never something that isn't a picture.
  const cdn = await setup({
    account: { ...ACCOUNT, avatar: 'https://cdn.robertsspaceindustries.com/x.jpg' },
    fetchFn,
  });
  await cdn.runner.scan();
  assert.equal(asked.length, 1);
  assert.equal(cdn.local.data.avatarImg, undefined);
  const { AVATAR_MAX } = await load();
  for (const [body, type] of [
    [new Uint8Array(AVATAR_MAX), 'image/jpeg'],
    ['<svg/>', 'image/svg+xml'],
    ['<html>', 'text/html'],
  ]) {
    const y = await setup({
      fetchFn: async () => new Response(body, { headers: { 'content-type': type } }),
    });
    await y.runner.scan();
    assert.equal(y.local.data.avatarImg, undefined, type);
  }
  const down = await setup({
    fetchFn: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal((await down.runner.scan()).bad, false, 'the scan goes on without it');
});

test("the portrait: one that couldn't be copied isn't asked for again; another pilot's goes", async () => {
  const { AVATAR_MAX } = await load();
  let asked = 0;
  const big = await setup({
    fetchFn: async () => {
      asked++;
      return new Response(new Uint8Array(AVATAR_MAX), {
        headers: { 'content-type': 'image/jpeg' },
      });
    },
  });
  await big.runner.scan();
  await big.runner.scan();
  assert.equal(asked, 1, 'once for that address');
  assert.deepEqual(big.session.data.avatarMiss, {
    nickname: 'Test_Pilot',
    url: ACCOUNT.avatar,
    at: 1_000_000,
  });
  // A new picture: asked for once more.
  const next = 'https://robertsspaceindustries.com/media/def456/heap_infobox/avatar.jpg';
  big.OH.getAccount = async () => ({ ...ACCOUNT, avatar: next });
  await big.runner.scan();
  await big.runner.scan();
  assert.equal(asked, 2);
  // Without session storage: remembered while the page is open.
  let tries = 0;
  const down = await setup({
    session: null,
    fetchFn: async () => {
      tries++;
      throw new TypeError('Failed to fetch');
    },
  });
  await down.runner.scan();
  await down.runner.scan();
  assert.equal(tries, 1);
  // Another pilot's copy goes when the one signed in has none to copy (RSI's default
  // picture lives on another host), and when theirs can't be copied.
  const other = {
    nickname: 'Other_Pilot',
    src: 'data:image/png;base64,AA==',
    at: 1,
    url: 'https://robertsspaceindustries.com/media/zzz/heap_infobox/a.png',
  };
  const plain = await setup({
    account: {
      ...ACCOUNT,
      avatar: 'https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg',
    },
    local: { avatarImg: other },
  });
  await plain.runner.scan();
  assert.equal(plain.local.data.avatarImg, undefined);
  const failed = await setup({
    local: { avatarImg: other },
    fetchFn: async () => new Response('', { status: 404 }),
  });
  await failed.runner.scan();
  assert.equal(failed.local.data.avatarImg, undefined);
  // Signed out: nothing read, the copy kept.
  const out = await setup({ account: { loggedIn: false }, local: { avatarImg: other } });
  await out.runner.scan();
  assert.deepEqual(out.local.data.avatarImg, other);
});

test('the wishlist import: only with its flag, connected and allowed to share', async () => {
  const sent = [];
  const fetchFn = async (url, init) => {
    sent.push(url);
    return { ok: true, status: 200 };
  };
  const off = await setup({ fetchFn, local: { wishlist: ['Cutlass Black'] } });
  await off.runner.wishlistToAccount();
  assert.deepEqual(sent, [], 'flag off: nothing');
  const no = await setup({
    fetchFn,
    flags: { wishlistImport: true },
    share: false,
    local: { wishlist: ['Cutlass Black'] },
  });
  await no.runner.wishlistToAccount();
  assert.deepEqual(sent, [], "Firefox's no: nothing");
  const on = await setup({
    fetchFn,
    flags: { wishlistImport: true },
    local: { wishlist: ['Cutlass Black'] },
  });
  await Promise.all([on.runner.wishlistToAccount(), on.runner.wishlistToAccount()]);
  assert.deepEqual(sent, ['https://app.openhangar.space/api/v1/wishlist/import'], 'once');
});

test('a page without session storage still scans (no marks, no kept syncs)', async () => {
  const x = await setup({ session: null });
  const r = await x.runner.scan();
  assert.equal(r.held, null);
  assert.equal(await x.runner.otherScan(), false);
  assert.equal(await x.runner.takeKeptSync(), null);
});
