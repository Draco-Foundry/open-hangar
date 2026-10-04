// The website Connect card (owner sign-off, 2026-10-04), in the Citizen Card's top
// right corner on Home. Optional: connect this extension to your openhangar.space
// account, then Sync Now (or after every scan). Its state and actions are in
// src/dashboard.js (window.OHApp.site). Store builds don't load this file until sync
// launches (the script tag sits in a @sync block, scripts/pack.mjs).
import { mount } from 'svelte';
import SiteConnect from './SiteConnect.svelte';

const card = document.querySelector('#view-home .citizen-card');
if (card && window.OHApp && window.OHApp.site) mount(SiteConnect, { target: card });
