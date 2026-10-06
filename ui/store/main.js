// Store page (0.3.0): Wishlist, Your CCUs and Find in Store, under a link to the
// website's full store. Ported from renderStore() as it looked in 0.2.x, so it
// reuses the dashboard's classes. renderStore() in src/dashboard.js only loads
// ship prices and RSI's store feed and fires 'oh:home' so this redraws.
import { mount } from 'svelte';
import Store from './Store.svelte';

const storeEl = document.getElementById('oh-store');
if (storeEl && window.OHApp) mount(Store, { target: storeEl });
