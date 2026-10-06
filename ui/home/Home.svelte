<script>
  // Home under the Citizen Card (docs/REDESIGN-0.3.md), two columns that finish
  // together: hangar value over your newest pledges on the left, a picture of one of
  // your ships over RSI Quick Links (#374) on the right. The last card in each column
  // takes the spare height (the ship picture fills when Quick Links is hidden). Game
  // Status (with events and the next buy-back token) sits beside the Citizen Card. RSI
  // news lives on the website only (owner, 2026-10-05). The Referrals card is parked
  // (./Referrals.svelte): re-add it when Home needs filling.
  import { app, version } from '../lib/app.svelte.js';
  import ValueCard from './ValueCard.svelte';
  import Acquisitions from './Acquisitions.svelte';
  import Spotlight from './Spotlight.svelte';
  import QuickLinks from './QuickLinks.svelte';

  const has = $derived.by(() => (version.n, app().state.items.length > 0));
</script>

<div class="oh-rows">
  <div class="oh-cols">
    {#if has}<div class="oh-col"><ValueCard /><Acquisitions /></div>{/if}
    <div class="oh-col">{#if has}<Spotlight />{/if}<QuickLinks /></div>
  </div>
</div>
