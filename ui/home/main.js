// Home page (0.3.0 redesign). The Citizen Card and the first-run welcome mount in the
// hero; the cards mount under it; Game Status mounts beside the card; Hangar Alerts (no
// markup) feeds the bell. See ui/lib/app.svelte.js for how data flows in.
import '../theme.css';
import './home.css';
import { mount } from 'svelte';
import Home from './Home.svelte';
import ForYou from './ForYou.svelte';
import StatusCard from './StatusCard.svelte';
import CitizenCard from './CitizenCard.svelte';
import SignedOut from './SignedOut.svelte';
import Welcome from './Welcome.svelte';
import { loadLive } from '../lib/app.svelte.js';

const homeEl = document.getElementById('oh-home');
const forYouEl = document.getElementById('oh-foryou');
if (homeEl && window.OHApp) {
  loadLive();
  // The Citizen Card goes before its status line (#status stays classic: setStatus
  // writes it), the signed-out wall after it; the welcome card above the search.
  const card = document.querySelector('#view-home .citizen-card');
  const status = card && card.querySelector('.cc-status');
  if (card) {
    mount(CitizenCard, { target: card, anchor: status || undefined });
    mount(SignedOut, { target: card });
  }
  const search = document.querySelector('#view-home .home-search');
  if (search) mount(Welcome, { target: search.parentNode, anchor: search });
  mount(Home, { target: homeEl });
  if (forYouEl) mount(ForYou, { target: forYouEl });
  const statusEl = document.getElementById('oh-status');
  if (statusEl) mount(StatusCard, { target: statusEl });
}
