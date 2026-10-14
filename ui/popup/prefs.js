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
// when the browser is light.
export function applyLook(look) {
  document.documentElement.dataset.look = LOOKS.includes(look) ? look : 'auto';
}
