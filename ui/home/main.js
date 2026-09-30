// Home page (0.3.0 redesign). Mounted into dashboard.html under the Citizen Card;
// Game Status mounts beside the card; Hangar Alerts (no markup) feeds the bell. See ui/lib/app.svelte.js for how data flows in.
import '../theme.css';
import './home.css';
import { mount } from 'svelte';
import Home from './Home.svelte';
import ForYou from './ForYou.svelte';
import StatusCard from './StatusCard.svelte';
import { loadLive } from '../lib/app.svelte.js';

const homeEl = document.getElementById('oh-home');
const forYouEl = document.getElementById('oh-foryou');
if (homeEl && window.OHApp) {
  loadLive();
  mount(Home, { target: homeEl });
  if (forYouEl) mount(ForYou, { target: forYouEl });
  const statusEl = document.getElementById('oh-status');
  if (statusEl) mount(StatusCard, { target: statusEl });
}
