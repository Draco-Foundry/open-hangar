<script>
  // Home under the Citizen Card, in priority order (docs/REDESIGN-0.3.md):
  // value + spotlight, then your newest pledges + news. Game Status
  // (with events and the next buy-back token) sits beside the Citizen Card. The
  // Referrals card is parked (./Referrals.svelte): re-add it when Home needs filling.
  import { app, version } from '../lib/app.svelte.js';
  import ValueCard from './ValueCard.svelte';
  import Acquisitions from './Acquisitions.svelte';
  import Spotlight from './Spotlight.svelte';
  import News from './News.svelte';

  const has = $derived.by(() => (version.n, app().state.items.length > 0));
</script>

<div class="oh-rows">
  {#if has}
    <div class="oh-row2">
      <ValueCard />
      <Spotlight />
    </div>
  {/if}
  <div class="oh-row2">
    {#if has}<Acquisitions />{/if}
    <News />
  </div>
</div>
