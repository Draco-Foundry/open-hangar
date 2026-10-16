// Loaded after demo-shim.js on the connector's own pages (src/popup.html,
// src/basic.html, src/scan.html): what only
// they use. Session storage, storage change events, the popup's messages to the
// background, new tabs and the browser's shortcuts, recorded on window.__demo for the
// UI test. Set before a page loads (evaluateOnNewDocument): __demoAccount (the
// `account` key), __demoAvatar (`avatarImg`), __demoLocal (any other local keys),
// __demoSession (session keys), __demoShortcut ('' for none set), __demoCookie ('out':
// signed out of RSI) and __demoWish (the account's Wishlist on the website).
(function () {
  const demo = (window.__demo = { sent: [], opened: [], listeners: [] });
  const session = {};
  const keysOf = (k, all) =>
    k == null
      ? Object.keys(all)
      : typeof k === 'string'
        ? [k]
        : Array.isArray(k)
          ? k
          : Object.keys(k);
  chrome.storage.session = {
    get: async (k) =>
      Object.fromEntries(
        keysOf(k, session)
          .filter((x) => x in session)
          .map((x) => [x, session[x]]),
      ),
    set: async (o) => void Object.assign(session, o),
    remove: async (k) => void keysOf(k, session).forEach((x) => delete session[x]),
  };
  chrome.storage.onChanged = {
    addListener: (f) => demo.listeners.push(f),
    removeListener: (f) => (demo.listeners = demo.listeners.filter((x) => x !== f)),
  };
  // As the browser does: every set and remove that changes something tells each
  // listener, a moment after the write, with the keys' old and new values.
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const told = (area, c) => {
    if (!Object.keys(c).length) return;
    setTimeout(() => {
      for (const f of [...demo.listeners]) f(c, area);
    }, 0);
  };
  for (const area of ['local', 'session']) {
    const s = chrome.storage[area];
    const { get, set, remove } = s;
    s.set = async (o) => {
      const keys = Object.keys(o || {});
      const before = await get(keys);
      await set(o);
      const after = await get(keys);
      const c = {};
      for (const k of keys)
        if (!same(before[k], after[k])) c[k] = { oldValue: before[k], newValue: after[k] };
      told(area, c);
    };
    s.remove = async (k) => {
      const before = await get(k == null ? null : keysOf(k, {}));
      await remove(k);
      const c = {};
      for (const x of Object.keys(before)) c[x] = { oldValue: before[x] };
      told(area, c);
    };
  }
  // The background's answers to the popup (src/background.js): its Scan
  // (requestScan) and the alerts it saw. `demo.answers` by ohPopup, or `demo.answer`
  // for every one.
  demo.answers = {};
  chrome.runtime.sendMessage = async (msg) => {
    demo.sent.push(msg);
    // An alert deleted (or Clear All): written the way the background writes it.
    if (msg?.ohPopup === 'alerts-hide' && window.OHAlerts) {
      const { alerts } = await chrome.storage.local.get('alerts');
      if (alerts)
        await chrome.storage.local.set({
          alerts: window.OHAlerts.hide(alerts, Date.now(), msg.id ?? null),
        });
    }
    const own = msg && demo.answers[msg.ohPopup];
    return own || demo.answer || { ok: true, opened: true };
  };
  // The browser's shortcut for the popup (manifest.json commands), and its own page.
  chrome.commands = {
    getAll: async () => [
      {
        name: '_execute_action',
        description: '',
        shortcut: window.__demoShortcut ?? 'Alt+Shift+H',
      },
    ],
  };
  chrome.tabs.create = (o) => void demo.opened.push(o.url);
  window.close = () => void (demo.closed = true);
  // Files the page saves (CSV, the backup) and pages it opens (Report a Scan Problem).
  demo.saved = [];
  const blobUrl = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => (demo.saved.push(b), blobUrl(b));
  window.open = (url) => void demo.opened.push(url);
  chrome.tabs.getCurrent = async () => ({ id: 42 });
  chrome.permissions = { contains: async () => true, request: async () => true };
  // Extension Alerts' permission asks and gives back, recorded (Notifications); set
  // __demoNotify = false for a browser that said no. __demoAlerts: storage to start with.
  demo.asked = [];
  demo.removed = [];
  const notifyOk = () => window.__demoNotify !== false;
  // Access to RSI turned off (Firefox's add-ons page): set __demoNoRsi; 'deny' says no
  // to the ask too.
  demo.rsiOff = !!window.__demoNoRsi;
  const rsi = (q) => q?.origins?.includes('https://robertsspaceindustries.com/*');
  chrome.permissions.contains = async (q) =>
    rsi(q)
      ? !demo.rsiOff
      : q?.permissions?.includes('notifications')
        ? notifyOk() && !demo.gaveBack
        : true;
  chrome.permissions.request = async (q) => {
    demo.asked.push(...(q?.permissions || []), ...(q?.origins || []));
    if (rsi(q)) return !(demo.rsiOff = window.__demoNoRsi === 'deny');
    demo.gaveBack = false;
    return q?.permissions?.includes('notifications') ? notifyOk() : true;
  };
  chrome.permissions.remove = async (q) => {
    demo.removed.push(...(q?.permissions || []));
    demo.gaveBack = true;
    return true;
  };
  // RSI's sign-in cookie (the popup's signed-out check, ui/popup/rsi-cookie.js): there
  // unless __demoCookie is 'out'. demo.setCookie(on) signs in or out "in another tab",
  // telling the cookie listeners as the browser does; Log Out of RSI (OH.logout) clears
  // it the same way. demo.cookieAsks counts the popup's checks.
  demo.cookie = window.__demoCookie !== 'out';
  demo.cookieAsks = 0;
  const cookieListeners = new Set();
  const RSI_COOKIE = {
    name: 'Rsi-Token',
    domain: '.robertsspaceindustries.com',
    path: '/',
    secure: true,
    value: 'demo',
  };
  demo.setCookie = (on) => {
    demo.cookie = !!on;
    for (const f of [...cookieListeners])
      f({ removed: !on, cookie: { ...RSI_COOKIE }, cause: 'explicit' });
  };
  chrome.cookies = {
    get: async (q) => {
      demo.cookieAsks++;
      return demo.cookie && q?.name === RSI_COOKIE.name ? { ...RSI_COOKIE } : null;
    },
    getAll: async () => (demo.cookie ? [{ ...RSI_COOKIE }] : []),
    remove: async (q) => {
      if (q?.name === RSI_COOKIE.name && demo.cookie) demo.setCookie(false);
      return q;
    },
    onChanged: {
      addListener: (f) => cookieListeners.add(f),
      removeListener: (f) => cookieListeners.delete(f),
    },
  };
  // Every request the page makes (rates.json and the feeds are answered by
  // demo-shim.js, never from the internet), and the account's Wishlist on
  // app.openhangar.space, answered here from __demoWish: { mode: 'items' (the website
  // takes changes) | 'keys' (read only), items: [the items read's shape] }; without it,
  // a 404 (the website's Wishlist off). demo.wish keeps each Wishlist request: method,
  // url, its Authorization and its body.
  demo.fetched = [];
  demo.wish = [];
  const wishState = window.__demoWish
    ? { mode: window.__demoWish.mode || 'items', items: [...(window.__demoWish.items || [])] }
    : null;
  const slugOf = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const answerJson = (body, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  function wishAnswer(url, init) {
    const auth = init?.headers?.Authorization || init?.headers?.authorization || '';
    const body = init?.body ? JSON.parse(init.body) : null;
    demo.wish.push({ method: init?.method || 'GET', url, auth, body });
    if (!wishState) return answerJson({ error: 'not found' }, 404);
    const keys = () => wishState.items.map((i) => i.key);
    if (!body) {
      if (wishState.mode === 'keys') return answerJson({ v: 1, keys: keys() });
      return answerJson({ v: 1, keys: keys(), items: wishState.items });
    }
    if (wishState.mode !== 'items') return answerJson({ error: 'not found' }, 404);
    // The website down for a change (demo.wishDown): a 503 with no Retry-After the
    // popup can read, as a cross-origin answer looks today.
    if (demo.wishDown) return answerJson({ error: 'try again later' }, 503);
    if (body.do === 'add') {
      const it = body.item;
      const m = /^(sku|upgrade)-(\d+)$/.exec(it.id || '');
      const key =
        it.kind === 'ship'
          ? `ship:${slugOf(it.name)}`
          : `${m[1] === 'upgrade' ? 'ccu' : 'sku'}:${m[2]}`;
      const item = {
        key,
        name: it.name,
        category: it.kind === 'ship' || it.kind === 'ccu' ? 'ships' : `${it.kind}s`,
        target: null,
        insurance: it.kind === 'ship' ? 'either' : null,
        from: null,
        at: Date.now(),
      };
      wishState.items = [item, ...wishState.items.filter((i) => i.key !== key)];
      return answerJson({ ok: true, outcome: 'added', key, on: true, item });
    }
    if (body.do === 'remove') {
      wishState.items = wishState.items.filter((i) => i.key !== body.key);
      return answerJson({ ok: true, outcome: 'removed', key: body.key, on: false });
    }
    const item = wishState.items.find((i) => i.key === body.key);
    if (!item) return answerJson({ ok: false, outcome: 'not-found', key: body.key, on: false });
    item.target = body.target == null ? null : Math.round(Number(body.target) * 100);
    return answerJson({ ok: true, outcome: 'saved', key: body.key, on: true, item });
  }
  const shimFetch = window.fetch;
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    demo.fetched.push(url);
    if (/\/api\/v1\/wishlist(\?|$)/.test(url)) return wishAnswer(url, init);
    // Disconnect's DELETE (OH.siteDisconnect): the website's half, stood in for.
    if (/\/api\/v1\/sync$/.test(url) && init?.method === 'DELETE')
      return Promise.resolve(new Response(null, { status: 204 }));
    return shimFetch(input, init);
  };
  if (window.__demoAlerts) chrome.storage.local.set(window.__demoAlerts);
  if (window.__demoAccount) chrome.storage.local.set({ account: window.__demoAccount });
  if (window.__demoAvatar) chrome.storage.local.set({ avatarImg: window.__demoAvatar });
  if (window.__demoLocal) chrome.storage.local.set(window.__demoLocal);
  if (window.__demoSession) Object.assign(session, window.__demoSession);
  chrome.runtime.reload = () => void (demo.reloaded = true);
  // Firefox before it lets the extension share, with our hangar page's ask waiting for
  // this tab (src/background.js oh-get-hangar): set by the UI test.
  if (window.__demoFirefoxLocal) {
    const manifest = chrome.runtime.getManifest;
    chrome.runtime.getManifest = () => ({
      ...manifest(),
      browser_specific_settings: { gecko: { id: 'open-hangar@draco-foundry' } },
    });
    chrome.permissions.contains = async (q) => (rsi(q) ? !demo.rsiOff : false);
    session.localAskFirefox = { at: Date.now(), tabId: 42 };
  }
})();
