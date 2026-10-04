// Stats page (0.3.0 rebuild), ported as it looks today: no signed-off redesign yet.
// Mounted into #stats-body in dashboard.html. Its look comes from the classic
// stylesheet (stat-box, bar-row, top-list…), shared with other pages, so this page
// ships no CSS of its own. See ui/lib/app.svelte.js for how data flows in.
import { mount } from 'svelte';
import Stats from './Stats.svelte';

const el = document.getElementById('stats-body');
if (el && window.OHApp) mount(Stats, { target: el });
