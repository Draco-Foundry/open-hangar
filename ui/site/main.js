// The website (openhangar.space), optional: connect this extension to your account
// and every scan syncs. Until you connect, the Connect card sits in the Citizen
// Card's top right corner on Home (owner sign-off, 2026-10-04); once connected it
// lives in the top bar: a section in the Scan ▾ menu (2026-10-05), and the Synced dot
// on your portrait with "Synced …" and Sync Now in its menu (Top Bar Option A,
// 2026-10-06), mounted into the spots ui/topbar leaves for them. Its state and
// actions are in src/dashboard.js (window.OHApp.site). Its script tag sits in a @sync
// block: every store build loads it, and only a build with the `sync` flag off doesn't.
import { mount } from 'svelte';
import SiteConnect from './SiteConnect.svelte';
import SyncStatus from './SyncStatus.svelte';
import SyncMenu from './SyncMenu.svelte';
import SyncLine from './SyncLine.svelte';
import YouDisconnect from './YouDisconnect.svelte';

if (window.OHApp && window.OHApp.site) {
  const at = (sel) => document.querySelector(sel);
  const card = at('#view-home .citizen-card');
  if (card) mount(SiteConnect, { target: card });
  if (at('#you-sync-dot')) mount(SyncStatus, { target: at('#you-sync-dot') });
  if (at('#you-menu-sync')) mount(SyncLine, { target: at('#you-menu-sync') });
  if (at('#scan-menu-site')) mount(SyncMenu, { target: at('#scan-menu-site') });
  if (at('#you-menu-site')) mount(YouDisconnect, { target: at('#you-menu-site') });
}
