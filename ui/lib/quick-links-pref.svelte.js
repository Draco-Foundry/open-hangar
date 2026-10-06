// Whether the Quick Links card shows on Home (#374). Hide Card on the card turns it
// off; Show on Home in your portrait menu's Quick Links group brings it back. Kept in
// chrome.storage.local with the other UI preferences (uiLayout, uiStatsTab...).
// One shared state (ui/lib lands in ui/shared.js), so the menu and Home agree.
export const qlPref = $state({ hidden: false });

try {
  chrome.storage.local
    .get('uiQuickLinksHidden')
    .then((r) => (qlPref.hidden = r?.uiQuickLinksHidden === true))
    .catch(() => {});
} catch {
  // No storage: the card shows.
}

export function setQuickLinksHidden(hidden) {
  qlPref.hidden = !!hidden;
  try {
    chrome.storage.local.set({ uiQuickLinksHidden: qlPref.hidden }).catch(() => {});
  } catch {
    // Not remembered; it just shows again next time.
  }
}
