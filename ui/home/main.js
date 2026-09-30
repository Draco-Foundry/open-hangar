// Home page (0.3.0 redesign). Mounted into dashboard.html under the Citizen Card;
// For You mounts beside the card. See ui/lib/app.svelte.js for how data flows in.
import '../theme.css';
import './home.css';
import { mount } from 'svelte';
import Home from './Home.svelte';
import ForYou from './ForYou.svelte';
import { loadLive } from '../lib/app.svelte.js';

const homeEl = document.getElementById('oh-home');
const forYouEl = document.getElementById('oh-foryou');
if (homeEl && window.OHApp) {
  loadLive();
  mount(Home, { target: homeEl });
  if (forYouEl) mount(ForYou, { target: forYouEl });
}
