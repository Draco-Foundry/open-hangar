<script>
  // Home under the Citizen Card, in priority order (docs/REDESIGN-0.3.md):
  // value + events + game status, then your pledges + spotlight, then news + referrals.
  import { app, version } from '../lib/app.svelte.js';
  import ValueCard from './ValueCard.svelte';
  import EventsCard from './EventsCard.svelte';
  import StatusCard from './StatusCard.svelte';
  import Acquisitions from './Acquisitions.svelte';
  import Spotlight from './Spotlight.svelte';
  import News from './News.svelte';
  import Referrals from './Referrals.svelte';

  const has = $derived.by(() => (version.n, app().state.items.length > 0));
  const recruits = $derived.by(() => (version.n, app().recruits));
</script>

<div class="oh-rows">
  <div class="oh-row3">
    {#if has}<ValueCard />{/if}
    <EventsCard />
    <StatusCard />
  </div>
  {#if has}
    <div class="oh-row2">
      <Acquisitions />
      <Spotlight />
    </div>
  {/if}
  <div class="oh-row21">
    <News />
    {#if recruits > 0}<Referrals />{/if}
  </div>
</div>
