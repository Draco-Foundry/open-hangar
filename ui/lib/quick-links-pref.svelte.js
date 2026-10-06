// Whether the Quick Links card shows on Home (#374). Hide Card on the card turns it
// off; Show on Home in your portrait menu's Quick Links group brings it back. Since
// Customize Home it's one of the layout's cards (ui/lib/home-layout.svelte.js, which
// also moves the old uiQuickLinksHidden setting over).
export { qlPref, setQuickLinksHidden } from './home-layout.svelte.js';
