// Loaded after demo-shim.js on the connector's own pages (src/popup.html,
// src/basic.html): what only
// they use. Session storage, storage change events, the popup's message to the
// background, and new tabs, recorded on window.__demo for the UI test.
(function () {
  const demo = (window.__demo = { sent: [], opened: [], listeners: [] });
  const session = {};
  const keysOf = (k) =>
    k == null
      ? Object.keys(session)
      : typeof k === 'string'
        ? [k]
        : Array.isArray(k)
          ? k
          : Object.keys(k);
  chrome.storage.session = {
    get: async (k) =>
      Object.fromEntries(
        keysOf(k)
          .filter((x) => x in session)
          .map((x) => [x, session[x]]),
      ),
    set: async (o) => void Object.assign(session, o),
    remove: async (k) => void keysOf(k).forEach((x) => delete session[x]),
  };
  chrome.storage.onChanged = {
    addListener: (f) => demo.listeners.push(f),
    removeListener: (f) => (demo.listeners = demo.listeners.filter((x) => x !== f)),
  };
  // The background's answer to the popup's Scan (src/background.js requestScan).
  chrome.runtime.sendMessage = async (msg) => {
    demo.sent.push(msg);
    return demo.answer || { ok: true, opened: true };
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
  chrome.runtime.reload = () => void (demo.reloaded = true);
})();
