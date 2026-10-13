// The top bar (0.3.0 redesign), drawn into the page's <header> on every page. Its
// look is in ui/theme.css and dashboard.html (the classic classes, unchanged); the
// scan, the settings and the menus' actions stay in src/dashboard.js
// (window.OHApp.top). The search box (#top-search, ui/search) waits in the header
// until the bar moves it into place.
import { mount } from 'svelte';
import TopBar from './TopBar.svelte';

const header = document.querySelector('.wrap > header');
if (header && window.OHApp) mount(TopBar, { target: header, props: { header } });
