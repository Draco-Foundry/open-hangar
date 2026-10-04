import './developers.css';
import { mount } from 'svelte';
import Developers from './Developers.svelte';

// Developers replaces the #view-developers markup and renderSupporters() /
// renderProfiles() in src/dashboard.js; its data tools' actions stay there
// (window.OHApp.dev). Mounted even while another page shows, since the card menus
// click #export-db and the damaged-database notice opens #import-file.
const devEl = document.getElementById('view-developers');
if (devEl && window.OHApp) mount(Developers, { target: devEl });
