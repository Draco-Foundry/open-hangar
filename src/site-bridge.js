// Firefox only: our own website's way in (#434, bridge v2). Chrome and Edge let our
// pages message the extension directly (externally_connectable); Firefox doesn't, so
// this tiny script runs in the top frame of our own pages (and only there,
// scripts/pack.mjs) and passes the page's messages to the background worker and its
// answers back. The background checks every message and decides what each page may
// ask (src/site-pages.js), the same as Chrome's way. It reads nothing on the page and
// sends nothing anywhere.
//
//   page → window.postMessage({ oh: 'ask', id, msg: { type, ... } }, origin)
//   page ← window.postMessage({ oh: 'answer', id, answer }, origin)
//
// An answer posted on the window can be read by any script on that page, so what keeps
// a page's answers to itself is that page's own script policy: for the hangar (our
// hangar page), its strict CSP with no script but its own.
(() => {
  // This build's pages, written by scripts/pack.mjs from the same list as this
  // script's matches in the manifest. Anywhere else it does nothing.
  const PAGES = [];
  // Every message type there is (src/site-pages.js); the background decides which
  // ones this page may ask.
  const TYPES = [
    'oh-hello',
    'oh-get-hangar',
    'oh-scan-status',
    'oh-request-scan',
    'oh-upgrade-options',
    'oh-upgrade-price',
    'oh-add-upgrade',
    'oh-connect-begin',
    'oh-connect-finish',
  ];
  const origin = location.origin;
  if (!PAGES.includes(origin)) return;
  window.addEventListener('message', (e) => {
    // Only this page itself, from exactly this origin.
    if (e.source !== window || e.origin !== origin) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || d.oh !== 'ask') return;
    if (typeof d.id !== 'string' || !d.id || d.id.length > 64) return;
    const msg = d.msg;
    if (!msg || typeof msg !== 'object' || !TYPES.includes(msg.type)) return;
    const back = (answer) => window.postMessage({ oh: 'answer', id: d.id, answer }, origin);
    try {
      chrome.runtime.sendMessage({ ohSite: msg }).then(
        (answer) => back(answer ?? null),
        () => back(null),
      );
    } catch {
      back(null); // the extension was updated or removed: reload the page
    }
  });
})();
