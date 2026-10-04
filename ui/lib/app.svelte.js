// The Svelte pages' view of the extension. The classic dashboard (src/dashboard.js)
// owns scanning, storage and the other pages; it exposes read-only helpers on
// window.OHApp and fires 'oh:home' whenever Home's or Stats' data changes. Components read
// `app()` inside $derived blocks that also read `version.n`, so they redraw then.
export const version = $state({ n: 0 });
if (typeof document !== 'undefined') {
  document.addEventListener('oh:home', () => version.n++);
}
export const app = () => window.OHApp;
export const OH = () => window.OH;

// Live data from outside the hangar (wiki, RSI news, patch notes). Loaded once per
// page view; each loader is cached by lib.js in chrome.storage.
export const live = $state({
  main: null, // starcitizen.tools main page settings: { event, patches }
  live: null, // LIVE version code from star-citizen.wiki
  released: null, // when that LIVE build was released (ms)
  news: [], // RSI Comm-Links
  twisc: null, // newest This Week in Star Citizen summary
  patches: [], // RSI Spectrum patch notes
  loaded: false,
});
let started = false;
export function loadLive() {
  if (started) return;
  started = true;
  const lib = OH();
  const safe = (p) => Promise.resolve(p).catch(() => null);
  Promise.all([
    safe(lib.getWikiMainpage()),
    safe(lib.getScVersion()),
    safe(lib.getRsiNews()),
    safe(lib.getTwiscSummary()),
    safe(lib.getPatchNotes()),
  ]).then(([main, v, news, twisc, patches]) => {
    live.main = main;
    live.live = v && v.code ? lib.formatScVersion(v.code).replace(/-LIVE$/i, '') : null;
    live.released = (v && v.released) || null;
    live.news = news || [];
    live.twisc = twisc;
    live.patches = patches || [];
    live.loaded = true;
  });
}
