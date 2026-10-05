// The website (openhangar.space), optional: connect this extension to your account
// and every scan syncs. Until you connect, the Connect card sits in the Citizen
// Card's top right corner on Home (owner sign-off, 2026-10-04); once connected it
// lives in the top bar's Scan button: a status beside it and a section in its ▾
// menu (2026-10-05), mounted into the spots ui/topbar leaves for them. Its state and
// actions are in src/dashboard.js (window.OHApp.site). Store builds don't load this
// file until sync launches (the script tag sits in a @sync block, scripts/pack.mjs).
import { mount } from 'svelte';
import SiteConnect from './SiteConnect.svelte';
import SyncStatus from './SyncStatus.svelte';
import SyncMenu from './SyncMenu.svelte';

if (window.OHApp && window.OHApp.site) {
  const at = (sel) => document.querySelector(sel);
  const card = at('#view-home .citizen-card');
  if (card) mount(SiteConnect, { target: card });
  if (at('#scan-sync-status')) mount(SyncStatus, { target: at('#scan-sync-status') });
  if (at('#scan-menu-site')) mount(SyncMenu, { target: at('#scan-menu-site') });
}
