// The popup's own settings, in one key (`popupPrefs`): the tab it was closed on, the
// Look (Match Browser, Dark, Light), the currency, the version whose What's New was
// read (Got It), and when the last scan report was shown (shown once).
export const LOOKS = ['auto', 'dark', 'light'];
// Amounts stay in dollars until exchange rates are wired into the popup: RSI charges in
// dollars anyway. More join this list then.
export const CURRENCIES = ['USD'];

export function cleanPrefs(p) {
  const o = p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  return {
    tab: typeof o.tab === 'string' ? o.tab : 'hangar',
    look: LOOKS.includes(o.look) ? o.look : 'auto',
    currency: CURRENCIES.includes(o.currency) ? o.currency : 'USD',
    seenVersion: typeof o.seenVersion === 'string' ? o.seenVersion : '',
    reportSeenAt: Number.isFinite(o.reportSeenAt) ? o.reportSeenAt : 0,
  };
}

export async function loadPrefs() {
  const { popupPrefs } = await chrome.storage.local.get('popupPrefs');
  return cleanPrefs(popupPrefs);
}

// One change, merged into what's stored (another popup may have changed something),
// one at a time so two quick changes can't drop each other.
let saving = Promise.resolve();
export function savePref(change) {
  saving = saving
    .catch(() => {})
    .then(async () => {
      const prefs = cleanPrefs({ ...(await loadPrefs()), ...change });
      await chrome.storage.local.set({ popupPrefs: prefs });
      return prefs;
    });
  return saving;
}

// The Look on <html>: tokens.css swaps to its light set for "light", and for "auto"
// when the browser is light. A copy stays in this page's localStorage (a per-browser
// convenience), so the next popup paints in it before popupPrefs is read.
const LOOK_COPY = 'ohPopupLook';
export function applyLook(look) {
  const l = LOOKS.includes(look) ? look : 'auto';
  document.documentElement.dataset.look = l;
  try {
    localStorage.setItem(LOOK_COPY, l);
  } catch {
    // No localStorage (blocked): the stored setting still applies once it's read.
  }
}
export function lastLook() {
  try {
    const l = localStorage.getItem(LOOK_COPY);
    return LOOKS.includes(l) ? l : 'auto';
  } catch {
    return 'auto';
  }
}
