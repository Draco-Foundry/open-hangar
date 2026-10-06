// Whether the Customize Home drawer (ui/home/Customize.svelte) is open. Opened from
// the portrait menu's Customize Home item or the quiet button at the end of Home.
export const cust = $state({ open: false });

export function openCustomize() {
  if (location.hash && location.hash !== '#home') location.hash = '#home';
  // One pop-up at a time: the top bar's menus and the Citizen Card's popups close.
  document.dispatchEvent(new CustomEvent('oh:close-menus'));
  document.dispatchEvent(new CustomEvent('oh:close-popups'));
  cust.open = true;
}
