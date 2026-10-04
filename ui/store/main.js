// Store page (0.3.0 rebuild): Wishlist, Your CCUs and Ship Prices. Ported from
// renderStore() as it looked in 0.2.x (no signed-off redesign yet), so it reuses
// the dashboard's classes. renderStore() in src/dashboard.js now only loads ship
// prices and RSI's store feed and fires 'oh:home' so this redraws.
import { mount } from 'svelte';
import Store from './Store.svelte';

const storeEl = document.getElementById('oh-store');
if (storeEl && window.OHApp) mount(Store, { target: storeEl });
