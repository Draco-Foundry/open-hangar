// Customize Home's state: which cards show, and your saved layouts (per browser,
// not per RSI account). Kept in chrome.storage.local as uiHomeLayout with the other
// UI preferences. One shared state (ui/lib lands in ui/shared.js), so the drawer,
// Home, the Quick Links card and the portrait menu's Show on Home all agree. The old
// Quick Links switch (uiQuickLinksHidden) moves in here the first time.
import {
  applyLayout,
  defaultCards,
  deleteLayout,
  normalizePref,
  saveLayout,
  DEFAULT_NAME,
} from './home-layout.js';

const KEY = 'uiHomeLayout';
export const layout = $state({ pref: normalizePref(null), loaded: false });

try {
  chrome.storage.local
    .get([KEY, 'uiQuickLinksHidden'])
    .then((r) => {
      layout.pref = normalizePref(r?.[KEY] || null, r?.uiQuickLinksHidden);
      layout.loaded = true;
      if (!r?.[KEY] && 'uiQuickLinksHidden' in (r || {})) {
        save();
        chrome.storage.local.remove('uiQuickLinksHidden').catch(() => {});
      }
    })
    .catch(() => (layout.loaded = true));
} catch {
  // No storage: the default layout.
  layout.loaded = true;
}

function save() {
  try {
    chrome.storage.local.set({ uiHomeLayout: $state.snapshot(layout.pref) }).catch(() => {});
  } catch {
    // Not remembered; Home shows the default next time.
  }
}

export const shown = (id) => layout.pref.cards[id] !== false;

export function setCard(id, on) {
  if (id === 'citizen') return;
  layout.pref = { ...layout.pref, cards: { ...layout.pref.cards, [id]: !!on } };
  save();
}

export function resetLayout() {
  layout.pref = { ...layout.pref, cards: defaultCards() };
  save();
}

// → '' when saved, else what's wrong (shown under the name box).
export function saveCurrent(name) {
  const r = saveLayout(layout.pref, name);
  if (!r.ok) return r.error;
  layout.pref = r.pref;
  save();
  return '';
}

export function applySaved(name) {
  layout.pref = applyLayout(layout.pref, name);
  save();
}

export function removeSaved(name) {
  if (name === DEFAULT_NAME) return;
  layout.pref = deleteLayout(layout.pref, name);
  save();
}

// The Quick Links card's Hide Card and the portrait menu's Show on Home (#374).
export const qlPref = {
  get hidden() {
    return !shown('quicklinks');
  },
};
export const setQuickLinksHidden = (hidden) => setCard('quicklinks', !hidden);
