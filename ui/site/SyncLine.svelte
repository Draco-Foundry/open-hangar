<script>
  // The sync line at the top of your portrait's menu once connected (Top Bar Option
  // A, owner 2026-10-06): a dot, "Synced 5:54 PM" (the whole time on hover) and Sync
  // Now. The only Sync Now; the Scan ▾ menu keeps Connected as and Open My Hangar
  // (SyncMenu.svelte).
  // Until you connect, the same spot offers Connect to openhangar.space, so it's
  // where people look, not only in the Citizen Card's corner (#434). It does what
  // that card's button does, the Firefox card first included (SiteConnect.svelte).
  import { app, version } from '../lib/app.svelte.js';
  import { synced } from './when.js';
  import FirefoxExplain from './FirefoxExplain.svelte';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.site.state;
    const at = s.link && synced(s.link.lastSync);
    return {
      shown: s.enabled && !!s.link,
      offer: s.enabled && !s.link,
      waiting: !!s.waiting,
      firefox: s.firefox,
      dataOk: s.dataOk,
      syncing: s.syncing,
      busy: a.top.bar.busy,
      done: !!at,
      text: s.syncing ? 'Syncing…' : at ? `Synced ${at.short}` : 'Connected. Your next scan syncs.',
      title: at ? `Synced to openhangar.space ${at.long}` : 'Connected to openhangar.space',
    };
  });
  // While the Firefox card is up: the button that opened it (focus goes back there).
  let explain = $state(null);
  function connect(e) {
    if (d.firefox && !d.dataOk) explain = e.currentTarget;
    else app().site.connect();
  }
</script>

{#if d.shown}
  <div class="menu-sync" id="menu-sync" class:on={d.done && !d.syncing}>
    <i class="ss-dot" class:on={d.done && !d.syncing} class:busy={d.syncing} aria-hidden="true"
    ></i><span title={d.title}>{d.text}</span><button
      type="button"
      class="menu-item"
      id="menu-sync-now"
      disabled={d.syncing || d.busy}
      onclick={() => app().site.sync()}>Sync Now</button
    >
  </div>
{:else if d.offer}
  <button type="button" class="menu-connect" id="menu-connect" disabled={d.waiting} onclick={connect}
    ><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
      ><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4" /><path
        d="M1.8 8h12.4M8 1.7c2 2.2 2 10.4 0 12.6M8 1.7c-2 2.2-2 10.4 0 12.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
      /></svg
    ><span
      ><b>{d.waiting ? 'Docking…' : 'Connect to openhangar.space'}</b><small
        >{d.waiting
          ? 'Finish in the window or tab that opened.'
          : 'Optional. See your hangar on any device.'}</small
      ></span
    ></button
  >
  {#if explain}
    <FirefoxExplain opener={explain} onClose={() => (explain = null)} />
  {/if}
{/if}
