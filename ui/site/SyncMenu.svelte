<script>
  // The website's section in the Scan ▾ menu once connected (owner sign-off,
  // 2026-10-05): Connected as <your RSI handle>, when it last synced, then Sync Now,
  // Open My Hangar ↗ and Disconnect (asked once, right here in the menu).
  import { tick } from 'svelte';
  import { app, version } from '../lib/app.svelte.js';
  import { synced } from './when.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.site.state;
    const at = s.link && synced(s.link.lastSync);
    return {
      shown: s.enabled && !!s.link,
      // Your RSI handle from the Citizen Card (the link's own name is the website login).
      handle: a.account?.nickname || a.state.owner?.nickname || '',
      when: s.syncing
        ? 'Beaming your hangar up…'
        : `${at ? `Synced ${at.long}` : 'Not synced yet'}. Every scan syncs.`,
      syncing: s.syncing,
      busy: a.top.bar.busy,
      msg: s.msg,
    };
  });

  let asking = $state(false); // Disconnect's "are you sure"
  let stay = $state();
  const site = () => app().site;

  // Opening the menu again starts fresh.
  $effect(() => {
    const caret = document.getElementById('scan-menu-btn');
    const reset = () => (asking = false);
    caret?.addEventListener('click', reset);
    return () => caret?.removeEventListener('click', reset);
  });
  async function ask() {
    asking = true;
    await tick();
    stay?.focus({ preventScroll: true });
  }
  async function disconnect() {
    asking = false;
    await site().disconnect();
  }
</script>

{#if d.shown}
  <div class="sm-site" id="scan-menu-sync" role="group" aria-labelledby="sm-site-head">
    <div class="sm-head" id="sm-site-head"><span>openhangar.space</span></div>
    <p class="sm-stat">
      <i class="ss-dot" class:on={!d.syncing} class:busy={d.syncing} aria-hidden="true"></i><span
        >Connected{#if d.handle}{' '}as <b>{d.handle}</b>{/if}<small>{d.when}</small></span
      >
    </p>
    {#if asking}
      <div class="sm-confirm" role="group" aria-label="Disconnect">
        <b>Disconnect From the Website?</b>
        <span
          >Your synced copy stays on openhangar.space until you delete it there. This extension
          just stops syncing.</span
        >
        <div class="sm-confirm-row">
          <button bind:this={stay} type="button" class="sc-btn" onclick={() => (asking = false)}
            >Stay Connected</button
          >
          <button type="button" class="sc-btn primary menu-item" onclick={disconnect}
            >Disconnect</button
          >
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="sm-act menu-item"
        id="site-sync-now"
        disabled={d.syncing || d.busy}
        onclick={() => site().sync()}>Sync Now</button
      >
      <button type="button" class="sm-act menu-item" onclick={() => site().open()}
        >Open My Hangar ↗</button
      >
      <button type="button" class="sm-act dim" onclick={ask}>Disconnect</button>
    {/if}
    {#if d.msg}<p class="sm-msg" role="status">{d.msg}</p>{/if}
  </div>
{/if}
