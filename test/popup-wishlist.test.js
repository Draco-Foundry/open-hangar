'use strict';
// The popup's Wishlist tab (ui/popup/wish-client.js, ui/popup/wishlist.js): the
// website's read and the one change at a time it sends, a 404 that keeps the list read
// only, polite waits, and a search that sends nothing. The privacy policy's "Your
// Wishlist" says what may go: which item, and the target price if you set one.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

const client = () => import('../ui/popup/wish-client.js');
const search = () => import('../ui/popup/wishlist.js');
const NOW = Date.UTC(2026, 9, 14, 12);
const MIN = 60e3;
const HOUR = 3600e3;
const SITE = 'https://app.example';
const LINK = { token: 'tok-1', name: 'pilot', connectedAt: 5 };

const item = (key, name, more = {}) => ({
  key,
  name,
  category: 'ships',
  target: null,
  insurance: 'either',
  from: null,
  at: 1,
  // Remind Me: null while the website doesn't offer it (no switch).
  remind: null,
  ...more,
});
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

// A fake browser: storage, the network (`answer(url, init)`), the clock and Firefox's
// data yes. `asked` keeps every request; `inFlight`/`most` how many ran at once.
function fakeEnv({ store = {}, answer = () => json({}, 500), now = NOW, share = true } = {}) {
  const env = {
    store: structuredClone(store),
    asked: [],
    inFlight: 0,
    most: 0,
    clock: now,
    answer,
    get: async (keys) =>
      Object.fromEntries(
        []
          .concat(keys)
          .filter((k) => k in env.store)
          .map((k) => [k, structuredClone(env.store[k])]),
      ),
    set: async (o) => Object.assign(env.store, structuredClone(o)),
    remove: async (keys) => [].concat(keys).forEach((k) => delete env.store[k]),
    fetch: async (url, init = {}) => {
      env.asked.push({ url: String(url), init });
      env.inFlight++;
      env.most = Math.max(env.most, env.inFlight);
      try {
        await new Promise((r) => setTimeout(r, 5));
        return await env.answer(String(url), init);
      } finally {
        env.inFlight--;
      }
    },
    now: () => env.clock,
    site: async () => SITE,
    mayShare: async () => share,
  };
  return env;
}

test('the read: items for the tab, keys only when the website keeps them read only', async () => {
  const { readList } = await client();
  const list = readList({
    v: 1,
    keys: ['ship:avenger-titan', 'sku:12', 'bad key', 'ccu:900'],
    items: [
      item('ship:avenger-titan', 'Avenger Titan', { target: 15000, insurance: 'lti' }),
      item('sku:12', 'Ghost Paint', { category: 'paints', insurance: null }),
      item('ccu:900', 'Upgrade to Carrack', { insurance: null, from: { id: 7, name: 'Cutlass' } }),
      { key: 'nope', name: 'x' },
      item('sku:12', 'Twice'),
      item('ship:x', '   '),
    ],
  });
  assert.deepEqual(list.keys, ['ship:avenger-titan', 'sku:12', 'ccu:900']);
  assert.deepEqual(
    list.items.map((i) => [i.key, i.name, i.target, i.insurance, i.from?.name ?? null]),
    [
      ['ship:avenger-titan', 'Avenger Titan', 15000, 'lti', null],
      ['sku:12', 'Ghost Paint', null, null, null],
      ['ccu:900', 'Upgrade to Carrack', null, null, 'Cutlass'],
    ],
  );
  assert.deepEqual(readList({ v: 1, keys: ['sku:1'] }), { keys: ['sku:1'], items: null });
  assert.equal(readList({ v: 2, keys: [] }), null);
  assert.equal(readList(null), null);
});

test("Target Price: the website's own rule, so nothing it refuses is sent", async () => {
  const { parseTarget, centsText } = await client();
  for (const [typed, cents] of [
    ['150', 15000],
    ['89.50', 8950],
    ['$1,234.5', 123450],
    [' 7 ', 700],
    ['.5', 50],
    ['', null],
    [null, null],
  ])
    assert.deepEqual(parseTarget(typed), { ok: true, cents }, String(typed));
  for (const typed of ['0', '-5', '1.234', 'abc', '1e3', '1000000.01', '9'.repeat(21)])
    assert.equal(parseTarget(typed).ok, false, typed);
  assert.equal(centsText(15000), '150');
  assert.equal(centsText(8950), '89.50');
  assert.equal(centsText(null), '');
});

test('not connected: nothing asked, and a copy left behind is deleted', async () => {
  const { loadWish, COPY_KEY } = await client();
  const env = fakeEnv({ store: { [COPY_KEY]: { v: 1, connectedAt: 5, at: NOW, items: [] } } });
  assert.equal((await loadWish(env)).mode, 'none');
  assert.equal(env.store[COPY_KEY], undefined);
  assert.deepEqual(env.asked, []);
});

test('reading: the items with the sync token, kept as a copy, used as it is while fresh', async () => {
  const { loadWish, COPY_KEY, FRESH_MS } = await client();
  const items = [item('ship:avenger-titan', 'Avenger Titan')];
  const env = fakeEnv({
    store: { siteLink: LINK },
    answer: () => json({ v: 1, keys: ['ship:avenger-titan'], items }),
  });
  const w = await loadWish(env);
  assert.equal(w.mode, 'edit');
  assert.deepEqual(w.items, items);
  assert.equal(env.asked.length, 1);
  const [{ url, init }] = env.asked;
  assert.equal(url, `${SITE}/api/v1/wishlist?with=items`);
  assert.equal(init.method, undefined, 'a GET');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.headers.Authorization, 'Bearer tok-1');
  assert.equal(init.body, undefined);
  assert.equal(env.store[COPY_KEY].connectedAt, 5);
  assert.deepEqual(env.store[COPY_KEY].items, items);
  // Fresh: the copy, nothing asked.
  env.clock += FRESH_MS - 1;
  assert.equal((await loadWish(env)).mode, 'edit');
  assert.equal(env.asked.length, 1);
  // Old: asked again.
  env.clock += 2;
  await loadWish(env);
  assert.equal(env.asked.length, 2);
});

test('the website keeps the Wishlist read only for the extension: its keys, read only', async () => {
  const { loadWish } = await client();
  const env = fakeEnv({
    store: { siteLink: LINK },
    answer: () => json({ v: 1, keys: ['ship:avenger-titan', 'sku:9'] }),
  });
  assert.deepEqual(await loadWish(env), {
    mode: 'keys',
    items: null,
    keys: ['ship:avenger-titan', 'sku:9'],
  });
});

test('a 404 (the feature is off): read only as before, not asked again for hours', async () => {
  const { loadWish, OFF_MS } = await client();
  const env = fakeEnv({ store: { siteLink: LINK }, answer: () => json({ error: 'x' }, 404) });
  assert.equal((await loadWish(env)).mode, 'off');
  env.clock += OFF_MS - MIN;
  assert.equal((await loadWish(env, { force: true })).mode, 'off');
  assert.equal(env.asked.length, 1, 'even a forced read waits');
  env.clock += 2 * MIN;
  await loadWish(env);
  assert.equal(env.asked.length, 2);
});

test('a read that fails: the copy stays, Retry-After honored, then a longer wait each time', async () => {
  const { loadWish, COPY_KEY, BACKOFF_MS } = await client();
  const copy = { v: 1, connectedAt: 5, at: NOW - HOUR, items: [item('sku:1', 'Paint')] };
  const env = fakeEnv({
    store: { siteLink: LINK, [COPY_KEY]: copy },
    answer: () => json({ error: 'slow down' }, 429, { 'retry-after': '600' }),
  });
  const w = await loadWish(env);
  assert.equal(w.mode, 'edit', 'the last copy still shows');
  assert.equal(env.store[COPY_KEY].retryAt, NOW + 600e3);
  env.clock += 599e3;
  await loadWish(env, { force: true });
  assert.equal(env.asked.length, 1, 'nothing during the Retry-After');
  // No network: backoff, doubling.
  env.clock = NOW + 601e3;
  env.answer = () => Promise.reject(new TypeError('Failed to fetch'));
  await loadWish(env);
  const first = env.store[COPY_KEY].retryAt - env.clock;
  env.clock = env.store[COPY_KEY].retryAt + 1;
  await loadWish(env);
  const second = env.store[COPY_KEY].retryAt - env.clock;
  assert.equal(env.asked.length, 3);
  assert.ok(first >= BACKOFF_MS && second === first * 2, `${first} then ${second}`);
  assert.deepEqual(env.store[COPY_KEY].items, copy.items);
});

test('a 401: the website ended this connection, nothing of it is kept', async () => {
  const { loadWish, COPY_KEY, OFF_MS } = await client();
  const env = fakeEnv({
    store: {
      siteLink: LINK,
      [COPY_KEY]: { v: 1, connectedAt: 5, at: 0, items: [item('sku:1', 'Paint')] },
    },
    answer: () => json({ error: 'not connected' }, 401),
  });
  assert.equal((await loadWish(env)).mode, 'error');
  // No items or keys, only when to ask again.
  const rec = env.store[COPY_KEY];
  assert.equal(rec.items, undefined);
  assert.equal(rec.keys, undefined);
  assert.equal(rec.retryAt, NOW + OFF_MS);
  // Opening the tab again (or a forced read) doesn't send the dead token again.
  for (let i = 0; i < 4; i++)
    assert.equal((await loadWish(env, { force: i % 2 === 1 })).mode, 'error');
  assert.equal(env.asked.length, 1, 'one GET for five opens');
  // Connecting again: a new connection's copy, read at once.
  env.store.siteLink = { ...LINK, token: 'tok-2', connectedAt: 6 };
  env.answer = () => json({ v: 1, keys: ['sku:1'], items: [item('sku:1', 'Paint')] });
  assert.equal((await loadWish(env)).mode, 'edit');
  assert.equal(env.asked.length, 2);
});

test("another connection's copy is deleted, and Firefox's no keeps everything home", async () => {
  const { loadWish, COPY_KEY } = await client();
  const env = fakeEnv({
    store: { siteLink: LINK, [COPY_KEY]: { v: 1, connectedAt: 4, at: NOW, items: [] } },
    share: false,
  });
  assert.equal((await loadWish(env)).mode, 'off');
  assert.equal(env.store[COPY_KEY], undefined);
  assert.deepEqual(env.asked, [], 'no data yes on Firefox: nothing asked');
});

test('disconnected while it was read: that answer is not kept', async () => {
  const { loadWish, COPY_KEY } = await client();
  const env = fakeEnv({ store: { siteLink: LINK } });
  env.answer = () => {
    delete env.store.siteLink;
    return json({ v: 1, keys: [], items: [] });
  };
  assert.equal((await loadWish(env)).mode, 'none');
  assert.equal(env.store[COPY_KEY], undefined);
});

// --- Changes -------------------------------------------------------------------------
const editing = (items, more = {}) => ({
  siteLink: LINK,
  popupWish: { v: 1, connectedAt: 5, at: NOW, items, ...more },
});
const sentBody = (env, i = 0) => JSON.parse(env.asked[i].init.body);

test('add: one POST with only the item, and the website’s copy of it goes first', async () => {
  const { writeWish } = await client();
  const was = [item('sku:12', 'Ghost Paint')];
  const added = item('ship:zeus-mk-ii-cl', 'Zeus Mk II CL');
  const env = fakeEnv({
    store: editing(was),
    answer: () => json({ ok: true, outcome: 'added', key: added.key, on: true, item: added }),
  });
  const r = await writeWish(env, { do: 'add', item: { kind: 'ship', name: 'Zeus Mk II CL' } });
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.items.map((i) => i.key),
    ['ship:zeus-mk-ii-cl', 'sku:12'],
  );
  assert.deepEqual(env.store.popupWish.items, r.items);
  const [{ url, init }] = env.asked;
  assert.equal(url, `${SITE}/api/v1/wishlist`);
  assert.equal(init.method, 'POST');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.headers.Authorization, 'Bearer tok-1');
  assert.deepEqual(sentBody(env), {
    v: 1,
    do: 'add',
    item: { kind: 'ship', name: 'Zeus Mk II CL' },
  });
  assert.doesNotMatch(init.body, /tok-1/, 'the token only in its header');
});

test('remove: only which item; no other change (the old Target Price save) is sent', async () => {
  const { writeWish } = await client();
  const titan = item('ship:avenger-titan', 'Avenger Titan', { insurance: 'lti' });
  const paint = item('sku:12', 'Ghost Paint', { insurance: null, category: 'paints' });
  const env = fakeEnv({ store: editing([titan, paint]) });
  env.answer = (url, init) => {
    const b = JSON.parse(init.body);
    return json({ ok: true, outcome: 'removed', key: b.key, on: false });
  };
  const removed = await writeWish(env, { do: 'remove', key: paint.key, name: 'x' });
  assert.deepEqual(sentBody(env, 0), { v: 1, do: 'remove', key: 'sku:12' });
  assert.deepEqual(
    removed.items.map((i) => i.key),
    ['ship:avenger-titan'],
  );
  // A target price can't be sent: the save is refused before anything goes.
  const saved = await writeWish(env, { do: 'save', key: titan.key, target: '150' });
  assert.equal(saved.ok, false);
  assert.equal(saved.error, 'refused');
  assert.equal(env.asked.filter((a) => a.init?.method === 'POST').length, 1, 'nothing more sent');
});

test('Remind Me: read only as a boolean, sent as a save with which item and on or off', async () => {
  const { readList, writeWish } = await client();
  // The website's wishlist_remind on: each item says; off (or anything else): no switch.
  const read = readList({
    v: 1,
    keys: ['sku:1', 'sku:2', 'sku:3'],
    items: [
      item('sku:1', 'A', { remind: false }),
      item('sku:2', 'B', { remind: true }),
      item('sku:3', 'C', { remind: 'no' }),
    ],
  });
  assert.deepEqual(
    read.items.map((i) => i.remind),
    [false, true, null],
  );
  const a = item('sku:1', 'A', { remind: true });
  const env = fakeEnv({ store: editing([a, item('sku:2', 'B', { remind: true })]) });
  env.answer = (url, init) => {
    const b = JSON.parse(init.body);
    return json({
      ok: true,
      outcome: 'saved',
      key: b.key,
      on: true,
      item: { ...a, remind: b.remind },
    });
  };
  const off = await writeWish(env, { do: 'remind', key: 'sku:1', remind: false, name: 'A' });
  // Only which item and on or off: nothing else goes.
  assert.deepEqual(sentBody(env, 0), { v: 1, do: 'save', key: 'sku:1', remind: false });
  assert.equal(off.ok, true);
  assert.deepEqual(
    off.items.map((i) => [i.key, i.remind]),
    [
      ['sku:1', false],
      ['sku:2', true],
    ],
  );
  // Not a boolean: refused before anything goes.
  const bad = await writeWish(env, { do: 'remind', key: 'sku:1', remind: 'off' });
  assert.equal(bad.error, 'refused');
  assert.equal(env.asked.length, 1);
  // The website no longer has it: it leaves the copy.
  env.answer = () => json({ ok: false, outcome: 'not-found', key: 'sku:2', on: false });
  const gone = await writeWish(env, { do: 'remind', key: 'sku:2', remind: false });
  assert.deepEqual(
    gone.items.map((i) => i.key),
    ['sku:1'],
  );
});

test('one change at a time: a second click waits for the first', async () => {
  const { writeWish } = await client();
  const env = fakeEnv({
    store: editing([item('sku:1', 'A'), item('sku:2', 'B')]),
    answer: (url, init) =>
      json({ ok: true, outcome: 'removed', key: JSON.parse(init.body).key, on: false }),
  });
  const [a, b] = await Promise.all([
    writeWish(env, { do: 'remove', key: 'sku:1' }),
    writeWish(env, { do: 'remove', key: 'sku:2' }),
  ]);
  assert.equal(env.asked.length, 2);
  assert.equal(env.most, 1, 'never two at once');
  assert.deepEqual(
    a.items.map((i) => i.key),
    ['sku:2'],
  );
  assert.deepEqual(b.items, []);
});

test('a change that fails is never tried again by itself; Retry-After holds the next one', async () => {
  const { writeWish, HOLD_MS } = await client();
  const env = fakeEnv({
    store: editing([item('sku:1', 'A')]),
    answer: () => json({ error: 'slow down' }, 429, { 'retry-after': '120' }),
  });
  const r = await writeWish(env, { do: 'remove', key: 'sku:1' });
  assert.deepEqual([r.ok, r.error], [false, 'net']);
  assert.equal(env.asked.length, 1, 'no retry');
  assert.deepEqual(
    r.items.map((i) => i.key),
    ['sku:1'],
    'nothing changed here',
  );
  env.clock += 119e3;
  const held = await writeWish(env, { do: 'remove', key: 'sku:1' });
  assert.equal(held.error, 'held');
  assert.equal(env.asked.length, 1, 'nothing sent while the website asked to wait');
  env.clock += 2e3;
  // A 503 (or a 429) whose Retry-After the popup can't read (a cross-origin answer
  // hides it): the website's minute holds the next one all the same.
  env.answer = () => json({ error: 'down' }, 503);
  assert.equal((await writeWish(env, { do: 'remove', key: 'sku:1' })).error, 'net');
  assert.equal(env.asked.length, 2);
  env.clock += HOLD_MS - 1e3;
  assert.equal((await writeWish(env, { do: 'remove', key: 'sku:1' })).error, 'held');
  assert.equal(env.asked.length, 2, 'held a minute with no Retry-After');
  env.clock += 2e3;
  // No network: one try.
  env.answer = () => Promise.reject(new TypeError('Failed to fetch'));
  assert.equal((await writeWish(env, { do: 'remove', key: 'sku:1' })).error, 'net');
  assert.equal(env.asked.length, 3);
});

test('a 429 with no Retry-After it can read: the next change waits a minute', async () => {
  const { writeWish, HOLD_MS, COPY_KEY } = await client();
  const env = fakeEnv({
    store: editing([item('sku:1', 'A')]),
    // What the popup sees of the website's 429 today: no exposed Retry-After.
    answer: () => json({ error: 'too many requests, try again in a minute' }, 429),
  });
  assert.equal((await writeWish(env, { do: 'remove', key: 'sku:1' })).error, 'net');
  assert.equal(env.store[COPY_KEY].holdUntil, NOW + HOLD_MS);
  assert.equal(HOLD_MS, 60e3, "the website's RETRY_AFTER_S");
  for (let i = 0; i < 2; i++)
    assert.equal((await writeWish(env, { do: 'remove', key: 'sku:1' })).error, 'held');
  assert.equal(env.asked.length, 1, 'two quick clicks after a 429 send nothing');
});

test('a 404 on a change: the website stopped taking them, the list is read again', async () => {
  const { writeWish, loadWish } = await client();
  const env = fakeEnv({
    store: editing([item('sku:1', 'A')]),
    answer: () => json({ error: 'not found' }, 404),
  });
  assert.equal((await writeWish(env, { do: 'remove', key: 'sku:1' })).error, 'off');
  env.answer = () => json({ v: 1, keys: ['sku:1'] });
  assert.equal((await loadWish(env)).mode, 'keys', 'read again at once, read only now');
  assert.equal(env.asked.length, 2);
});

test('the website said no: the list is full, or it was gone', async () => {
  const { writeWish } = await client();
  const env = fakeEnv({ store: editing([item('sku:1', 'A')]) });
  env.answer = () => json({ ok: false, outcome: 'limit', key: 'ship:x', on: false });
  const full = await writeWish(env, { do: 'add', item: { kind: 'ship', name: 'X' } });
  assert.deepEqual([full.ok, full.error, full.outcome], [false, 'refused', 'limit']);
  assert.deepEqual(
    full.items.map((i) => i.key),
    ['sku:1'],
  );
  env.answer = () => json({ ok: false, outcome: 'not-found', key: 'sku:1', on: false });
  const gone = await writeWish(env, { do: 'remove', key: 'sku:1' });
  assert.deepEqual(gone.items, [], 'an item the website no longer has leaves the copy');
  assert.equal(env.asked.length, 2);
});

test('taken with no copy of the item: the list is read again next time', async () => {
  const { writeWish, loadWish } = await client();
  const env = fakeEnv({
    store: editing([]),
    answer: () => json({ ok: true, outcome: 'added', key: 'sku:5', on: true }),
  });
  const r = await writeWish(env, { do: 'add', item: { kind: 'paint', id: 'sku-5', name: 'P' } });
  assert.equal(r.stale, true);
  env.answer = () => json({ v: 1, keys: ['sku:5'], items: [item('sku:5', 'P')] });
  assert.deepEqual(
    (await loadWish(env)).items.map((i) => i.key),
    ['sku:5'],
  );
});

test('not connected, or Firefox without its data yes: no change is sent', async () => {
  const { writeWish } = await client();
  const off = fakeEnv({ store: {} });
  assert.equal((await writeWish(off, { do: 'remove', key: 'sku:1' })).error, 'not-connected');
  const ff = fakeEnv({ store: editing([item('sku:1', 'A')]), share: false });
  assert.equal((await writeWish(ff, { do: 'remove', key: 'sku:1' })).error, 'not-allowed');
  assert.deepEqual([...off.asked, ...ff.asked], []);
});

// --- The search ----------------------------------------------------------------------
const FEED = {
  v: 1,
  ships: [
    { slug: 'avenger-titan', name: 'Avenger Titan', keys: [] },
    { slug: 'zeus-mk-ii-cl', name: 'Zeus Mk II CL', keys: [] },
  ],
  items: [
    { id: 'sku-10', kind: 'ship', name: 'Avenger Titan Warbond', price: 55, ships: [] },
    { id: 'sku-20', kind: 'paint', name: 'Titan - Ghost Paint', price: 10, ships: [] },
    { id: 'sku-21', kind: 'starter', name: 'Titan Starter Pack', price: 60, ships: [] },
    { id: 'sku-22', kind: 'subscriber', name: 'Titan Flair', price: 5, ships: [] },
    { id: 'sku-23', kind: 'gear', name: 'Titan Armor', price: 20, ships: [] },
    { id: 'upgrade-5', kind: 'upgrade', name: 'Upgrade to Avenger Titan', price: 30, ships: [] },
    { id: 'upgrade-6', kind: 'paint', name: 'Odd One', price: 1, ships: [] },
    { id: 'sku-24', kind: 'other', name: 'Titan Thing', price: 1, ships: [] },
  ],
};

test('search: ships from the ship lists, store items and upgrades from the sale feed', async () => {
  const { searchEntries } = await search();
  const names = new Map([
    ['avenger-titan', 'Avenger Titan (old name)'],
    ['carrack', 'Carrack'],
  ]);
  const all = searchEntries({ names, feed: FEED, onList: ['ship:zeus-mk-ii-cl'] });
  assert.deepEqual(
    all.map((e) => [e.key, e.kind, e.name]),
    [
      ['ship:avenger-titan', 'ship', 'Avenger Titan'],
      ['ship:carrack', 'ship', 'Carrack'],
      ['sku:20', 'paint', 'Titan - Ghost Paint'],
      ['sku:21', 'pack', 'Titan Starter Pack'],
      ['sku:22', 'addon', 'Titan Flair'],
      ['sku:23', 'gear', 'Titan Armor'],
      ['ccu:5', 'ccu', 'Upgrade to Avenger Titan'],
    ],
  );
  // What an add sends: the website's add shapes (it places the item itself).
  const byKey = Object.fromEntries(all.map((e) => [e.key, e.item]));
  assert.deepEqual(byKey['ship:carrack'], { kind: 'ship', name: 'Carrack' });
  assert.deepEqual(byKey['sku:21'], { kind: 'pack', id: 'sku-21', name: 'Titan Starter Pack' });
  assert.deepEqual(byKey['ccu:5'], {
    kind: 'ccu',
    id: 'upgrade-5',
    name: 'Upgrade to Avenger Titan',
  });
  // Alerts off (no sale feed): ships only, from the ship list.
  assert.deepEqual(
    searchEntries({ names }).map((e) => e.key),
    ['ship:avenger-titan', 'ship:carrack'],
  );
});

test('search: every word, the closest first, two letters at least, and nothing sent', async () => {
  const { searchEntries, searchWish } = await search();
  const was = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    throw new Error('the search asks nothing');
  };
  try {
    const all = searchEntries({ feed: FEED });
    assert.deepEqual(searchWish(all, 'a'), []);
    assert.deepEqual(
      searchWish(all, 'titan').map((e) => e.name),
      [
        'Titan Armor',
        'Titan Flair',
        'Titan Starter Pack',
        'Titan - Ghost Paint',
        'Avenger Titan',
        'Upgrade to Avenger Titan',
      ],
    );
    assert.deepEqual(
      searchWish(all, 'ghost titan').map((e) => e.key),
      ['sku:20'],
    );
    assert.deepEqual(
      searchWish(all, 'AVENGER').map((e) => e.key),
      ['ship:avenger-titan', 'ccu:5'],
    );
    assert.equal(searchWish(all, 'titan', 2).length, 2);
    assert.deepEqual(asked, []);
  } finally {
    globalThis.fetch = was;
  }
});

test("the search's words: ships only with alerts off, No matches only for a search", async () => {
  const { searchEntries, searchWish, searchHint, searched } = await search();
  const { t } = await import('../ui/popup/copy.js');
  // The placeholder says what the search covers: the sale feed brings paints and upgrades.
  assert.equal(t(searchHint(FEED)), 'Add a ship, paint or upgrade');
  assert.equal(t(searchHint(null)), 'Add a ship', 'alerts off: no sale feed');
  // Alerts off: a paint's name finds nothing, and it was searched, so the tab says so.
  const ships = searchEntries({ names: new Map([['avenger-titan', 'Avenger Titan']]) });
  assert.deepEqual(searchWish(ships, 'ghost paint'), []);
  assert.equal(searched('ghost paint'), true);
  assert.equal(searched('ti'), true);
  // Too short, only spaces or only marks: not searched, so nothing is said.
  for (const typed of ['', '   ', 'a', ' g ', '--', null])
    assert.equal(searched(typed), false, String(typed));
  assert.equal(t('popup.wish-no-match'), 'No matches.');
  assert.equal(t('popup.wish-not-added', { name: 'Zeus Mk II CL' }), "Couldn't add Zeus Mk II CL.");
});

test('the sale line: only with a sale feed, a ship at its cheapest edition', async () => {
  const { wishSale } = await import('../ui/popup/data.js');
  assert.equal(wishSale(null), null, 'alerts off: nothing said about sales');
  const sale = wishSale({
    items: [
      { id: 'sku-10', kind: 'ship', name: 'Titan WB', price: 55, ships: ['avenger-titan'] },
      { id: 'sku-11', kind: 'ship', name: 'Titan', price: 70, ships: ['avenger-titan'] },
      { id: 'upgrade-5', kind: 'upgrade', name: 'Up', price: 30, ships: [] },
    ],
  });
  assert.deepEqual(sale('ship:avenger-titan'), { onSale: true, price: 55 });
  assert.deepEqual(sale('ccu:5'), { onSale: true, price: 30 });
  assert.deepEqual(sale('ship:zeus'), { onSale: false, price: null });
  assert.deepEqual(sale('sku:99'), { onSale: false, price: null });
});

test('alerts follow Remind Me: on from the switch, off with the last one, left alone otherwise', async () => {
  const { alertsFor } = await search();
  const on = [
    { key: 'ship:a', remind: true },
    { key: 'ship:b', remind: false },
  ];
  const off = [{ key: 'ship:a', remind: false }];
  assert.equal(alertsFor({ do: 'remind', key: 'ship:a', remind: true }, on), true);
  assert.equal(alertsFor({ do: 'remind', key: 'ship:a', remind: false }, off), false);
  assert.equal(alertsFor({ do: 'remove', key: 'ship:a' }, []), null, 'nothing to read');
  assert.equal(alertsFor({ do: 'remove', key: 'ship:b' }, on), null, 'Remind Me still on');
  assert.equal(
    alertsFor({ do: 'remove', key: 'ship:a' }, [{ key: 'ship:b', remind: false }]),
    false,
  );
  // An item added starts with Remind Me on (the website's default): alerts on. An add
  // the website answered with Remind Me off everywhere: off, as for any change.
  const added = [{ key: 'ship:c', remind: true }, ...off];
  assert.equal(alertsFor({ do: 'add', item: { kind: 'ship', name: 'C' } }, added), true);
  assert.equal(alertsFor({ do: 'add', item: { kind: 'ship', name: 'C' } }, off), false);
  // The website offers no Remind Me (null on every item): alerts are left as they are.
  assert.equal(
    alertsFor({ do: 'remind', key: 'ship:a', remind: true }, [{ key: 'ship:a', remind: null }]),
    null,
  );
});

// The sale feed as the store alerts keep it: a ship sold in two editions, and a paint.
const SALE = {
  items: [
    { id: 'sku-1', kind: 'ship', name: 'Cutlass Black', price: 110, ships: ['cutlass-black'] },
    { id: 'sku-2', kind: 'ship', name: 'Cutlass Black WB', price: 100, ships: ['cutlass-black'] },
    { id: 'sku-30', kind: 'paint', name: 'Coalfire', price: 5, ships: [] },
  ],
};

test("the Wishlist tab's count: Remind Me items on sale, each once", async () => {
  const { remindOnSale } = await import('../ui/popup/data.js');
  // The ship (two editions on sale) counts once; the paint counts; Zeus isn't sold.
  const keys = ['ship:cutlass-black', 'sku:30', 'ship:zeus-mk-ii-cl', 'ship:cutlass-black'];
  assert.equal(remindOnSale(keys, SALE), 2);
  assert.equal(remindOnSale([], SALE), 0);
  // No sale feed kept, or no keys: nothing to count.
  assert.equal(remindOnSale(keys, null), 0);
  assert.equal(remindOnSale(null, SALE), 0);
});

test('the Wishlist: what is on sale first, each side in its own order', async () => {
  const { onSaleFirst, wishSale } = await import('../ui/popup/data.js');
  const list = [{ key: 'ship:zeus-mk-ii-cl' }, { key: 'sku:30' }, { key: 'ship:aurora-mr' }];
  list.push({ key: 'ship:cutlass-black' });
  assert.deepEqual(
    onSaleFirst(list, wishSale(SALE)).map((x) => x.key),
    ['sku:30', 'ship:cutlass-black', 'ship:zeus-mk-ii-cl', 'ship:aurora-mr'],
  );
  // No sale feed kept: the list as it is.
  assert.equal(onSaleFirst(list, wishSale(null)), list);
});
