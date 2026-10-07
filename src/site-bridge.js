// Firefox only: our own website's way in (#434). Chrome and Edge let openhangar.space
// message the extension directly (externally_connectable); Firefox doesn't, so this
// tiny script runs on our own site's pages (and only there, scripts/pack.mjs) and
// passes the page's messages to the background worker and its answers back. Same
// messages, same handlers and the same origin check as Chrome's way
// (src/background.js siteHandlers): Add to RSI Cart, and Connect This Browser in
// builds with sync. It reads nothing on the page and sends nothing anywhere.
//
//   page → window.postMessage({ oh: 'ask', id, msg }, origin)
//   page ← window.postMessage({ oh: 'answer', id, answer }, origin)
(() => {
  const origin = location.origin;
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== origin) return;
    const d = e.data;
    if (!d || d.oh !== 'ask' || typeof d.id !== 'string') return;
    const back = (answer) => window.postMessage({ oh: 'answer', id: d.id, answer }, origin);
    try {
      chrome.runtime.sendMessage({ ohSite: d.msg }).then(
        (answer) => back(answer ?? null),
        () => back(null),
      );
    } catch {
      back(null); // the extension was updated or removed: reload the page
    }
  });
})();
