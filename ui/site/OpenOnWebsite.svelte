<script>
  // The website from the pages that have a twin there (Home, Inventory, Buy-Backs,
  // Stats). Connected: Open on Website ↗, your hangar on openhangar.space (its My
  // Hangar page for now; the pages per tab aren't open on the website yet). Not
  // connected: See It on Any Device, which starts Connect like the portrait menu's
  // (SyncLine.svelte), the Firefox card first until Firefox has said yes. Home passes
  // offer={false}: its Citizen Card already has Connect. Hidden until the website is
  // switched on (OH.siteEnabled).
  import { app, version } from '../lib/app.svelte.js';
  import FirefoxExplain from './FirefoxExplain.svelte';

  let { offer = true } = $props();
  const d = $derived.by(() => {
    version.n;
    const s = app().site.state;
    return {
      open: s.enabled && !!s.link,
      offer: offer && s.enabled && !s.link,
      waiting: !!s.waiting,
      firefox: s.firefox,
      dataOk: s.dataOk,
    };
  });
  // While the Firefox card is up: the button that opened it (focus goes back there).
  let explain = $state(null);
  function connect(e) {
    if (d.firefox && !d.dataOk) explain = e.currentTarget;
    else app().site.connect();
  }
</script>

{#if d.open}
  <p class="site-open">
    <button
      type="button"
      class="site-open-btn"
      title="Your hangar on openhangar.space"
      onclick={() => app().site.open()}>Open on Website ↗</button
    >
  </p>
{:else if d.offer}
  <p class="site-open">
    <button
      type="button"
      class="site-open-btn"
      title="Connect to openhangar.space. Optional, nothing is sent until you connect."
      disabled={d.waiting}
      onclick={connect}>{d.waiting ? 'Docking…' : 'See It on Any Device'}</button
    >
  </p>
  {#if explain}
    <FirefoxExplain opener={explain} onClose={() => (explain = null)} />
  {/if}
{/if}
