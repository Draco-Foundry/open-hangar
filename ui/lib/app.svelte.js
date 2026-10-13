// The Svelte pages' view of the extension. The classic dashboard (src/dashboard.js)
// owns scanning, storage and the other pages; it exposes read-only helpers on
// window.OHApp and fires 'oh:home' whenever Home's data changes. Components read
// `app()` inside $derived blocks that also read `version.n`, so they redraw then.
export const version = $state({ n: 0 });
if (typeof document !== 'undefined') {
  document.addEventListener('oh:home', () => version.n++);
}
export const app = () => window.OHApp;
export const OH = () => window.OH;
