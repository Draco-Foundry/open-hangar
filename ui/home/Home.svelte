<script>
  // Home under the Citizen Card, in priority order (docs/REDESIGN-0.3.md):
  // value + spotlight, then your newest pledges + news, then referrals. Game Status
  // (with events and the next buy-back token) sits beside the Citizen Card.
  import { app, version } from '../lib/app.svelte.js';
  import ValueCard from './ValueCard.svelte';
  import Acquisitions from './Acquisitions.svelte';
  import Spotlight from './Spotlight.svelte';
  import News from './News.svelte';
  import Referrals from './Referrals.svelte';

  const has = $derived.by(() => (version.n, app().state.items.length > 0));
  const recruits = $derived.by(() => (version.n, app().recruits));
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
  {#if recruits > 0}<Referrals />{/if}
</div>
