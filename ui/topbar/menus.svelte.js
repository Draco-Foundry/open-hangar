// The top bar's pop-up menus (Scan options, Hangar Alerts, your menu). One is open
// at a time. Each is pinned to the viewport under its button (ui/lib/place.js), so
// nothing clips it. Escape closes it and puts focus back on its button; clicks inside
// don't close it (checkboxes, the currency picker), except on a link or an action;
// scrolling, resizing or a click anywhere else closes it. dashboard.js closes them
// with the 'oh:close-menus' event (closeCardMenus(), before a scan starts).
import { flushSync } from 'svelte';
import { placeUnder } from '../lib/place.js';

export const menus = $state({ open: null });
const parts = new Map(); // name → { btn, menu }

// A menu's button and panel, from bind:this in its component.
export function register(name, btn, menu) {
  parts.set(name, { btn, menu });
}

export function closeMenus() {
  if (!menus.open) return;
  // Right away, so the menu is gone before anything reads the page.
  flushSync(() => (menus.open = null));
}

export function toggleMenu(name, e) {
  e.stopPropagation(); // the document's click handler would close it again
  const was = menus.open === name;
  closeMenus();
  if (was) return;
  openMenu(name);
}

// Open a menu under its button. `focus`: move into it, on its first control you can
// see (no scrolling: that closes it); off when it opens by itself (the scan report).
export function openMenu(name, { focus = true } = {}) {
  closeMenus();
  const { btn, menu } = parts.get(name) || {};
  if (!btn || !menu) return;
  flushSync(() => (menus.open = name));
  const pos = placeUnder(btn, menu); // now that it has a size
  menu.style.right = `${pos.right}px`;
  menu.style.top = `${pos.top}px`;
  if (!focus) return;
  [...menu.querySelectorAll('a[href], button:not([disabled]), input, select')]
    .find((el) => el.getClientRects().length)
    ?.focus({ preventScroll: true });
}

// The panel's onclick: stay open, unless it was a link or an action
// (Updates, Log Out of RSI…).
export function menuClick(e) {
  e.stopPropagation();
  if (e.target.closest('a, .menu-item')) closeMenus();
}

if (typeof document !== 'undefined') {
  window.addEventListener('resize', closeMenus);
  window.addEventListener('scroll', closeMenus, { passive: true });
  document.addEventListener('click', closeMenus);
  document.addEventListener('oh:close-menus', closeMenus);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !menus.open) return;
    const { btn } = parts.get(menus.open) || {};
    closeMenus();
    btn?.focus({ preventScroll: true });
  });
}
