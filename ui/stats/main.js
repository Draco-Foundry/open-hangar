import { mount } from 'svelte';
import Stats from './Stats.svelte';

// Stats (all its tabs) replaces renderStats() in src/dashboard.js, which now only
// loads ship prices and loaners and fires 'oh:home' so this redraws.
const statsEl = document.getElementById('stats-body');
if (statsEl && window.OHApp) mount(Stats, { target: statsEl });
