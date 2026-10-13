// Escape takes off the newest filter, one per press (owner, 2026-10-05), the same
// as the website's Store page. Inventory and Buy-Backs each keep the order their
// pills went on; a pill's ✕ path does the removing, so counts, saved-view marks and
// anything stored update exactly as by hand. Escape keeps its own job in a box being
// typed in and while a menu, pop-up or the picture viewer is open.

// Each active filter's id: "group|key", as the pills key them.
export const filterId = (a) => `${a.group}|${a.key}`;

// Still-set filters keep their place; new ones go on the end, in the order given
// (so the filters already on when the page opens count in pill order).
export function stackOrder(prev, now) {
  const keep = prev.filter((id) => now.includes(id));
  return [...keep, ...now.filter((id) => !keep.includes(id))];
}

// Anything else that wants this Escape: a menu (Export, the top bar's, the scan
// report), the detail window, the picture viewer, the Firefox card, Global Hangar
// Search's results. Only what's on screen counts (other pages are hidden).
const OTHERS =
  '[aria-modal="true"], dialog[open], [aria-expanded="true"], .gsearch-results:not([hidden])';
const onScreen = (el) => el.getClientRects().length > 0;
export function escapeIsFree(e) {
  if (e.key !== 'Escape' || e.repeat || e.defaultPrevented) return false;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  const t = e.target instanceof HTMLElement ? e.target : null;
  if (t && (t.isContentEditable || t.closest('input, textarea, select'))) return false;
  return ![...document.querySelectorAll(OTHERS)].some(onScreen);
}

// Wires one page: `page` is its root element (only acts while it's the page shown),
// `active()` its pills, `remove(group, key)` the pill's ✕, `live` an aria-live
// element for the quiet "Removed filter: LTI". `track(pills)` records the order (call
// it whenever the pills change) and `stop()` unhooks the key listener.
export function escapeClearsFilters({ page, active, remove, live }) {
  let order = [];
  const track = (list = active()) => {
    order = stackOrder(order, list.map(filterId));
  };
  // On the capture side, so it looks before the pop-ups close themselves.
  const onKey = (e) => {
    if (!page.closest('.view')?.classList.contains('active') || !escapeIsFree(e)) return;
    const list = active();
    track(list);
    const last = order[order.length - 1];
    const hit = list.find((a) => filterId(a) === last);
    if (!hit) return;
    remove(hit.group, hit.key);
    track();
    if (live) live.textContent = `Removed filter: ${hit.label}`;
  };
  window.addEventListener('keydown', onKey, true);
  return { track, stop: () => window.removeEventListener('keydown', onKey, true) };
}
