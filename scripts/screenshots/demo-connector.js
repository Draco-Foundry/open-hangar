// Loaded after demo-shim.js on the connector's own pages (src/popup.html,
// src/basic.html): what only
// they use. Session storage, storage change events, the popup's messages to the
// background, new tabs and the browser's shortcuts, recorded on window.__demo for the
// UI test. Set before a page loads (evaluateOnNewDocument): __demoAccount (the
// `account` key), __demoAvatar (`avatarImg`), __demoLocal (any other local keys),
// __demoSession (session keys), __demoShortcut ('' for none set).
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
