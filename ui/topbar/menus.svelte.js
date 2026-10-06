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

// A menu's button and panel, from bind:this in its component. `left`: lined up with
// its button's left edge instead of its right (More, which sits among the page links).
export function register(name, btn, menu, { left = false } = {}) {
  parts.set(name, { btn, menu, left });
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
  const { btn, menu, left } = parts.get(name) || {};
  if (!btn || !menu) return;
  flushSync(() => (menus.open = name));
  const pos = placeUnder(btn, menu); // now that it has a size
  if (left) {
    const x = btn.getBoundingClientRect().left;
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.right = 'auto';
  } else menu.style.right = `${pos.right}px`;
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
    if (!menus.open) return;
    // Arrow keys move through the open menu's controls (from its button too); the
    // currency picker and text boxes keep their own arrows.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const { btn, menu } = parts.get(menus.open) || {};
      if (!menu || /^(SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.target.matches?.('input:not([type=checkbox])')) return;
      if (e.target !== btn && !menu.contains(e.target)) return;
      const all = [
        ...menu.querySelectorAll('a[href], button:not([disabled]), input, select'),
      ].filter((el) => el.getClientRects().length);
      if (!all.length) return;
      e.preventDefault();
      const i = all.indexOf(e.target);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const n = i < 0 ? (step > 0 ? 0 : all.length - 1) : (i + step + all.length) % all.length;
      all[n].focus({ preventScroll: true });
      return;
    }
    if (e.key !== 'Escape') return;
    const { btn } = parts.get(menus.open) || {};
    closeMenus();
    btn?.focus({ preventScroll: true });
  });
}
