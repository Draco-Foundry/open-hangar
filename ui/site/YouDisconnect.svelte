<script>
  // Disconnect lives in your portrait's menu with the other account actions (Log Out
  // of RSI, Clear Data), not in the Scan ▾ menu (owner, 2026-10-05). Asked once,
  // right here; the menu stays open for the question.
  import { tick } from 'svelte';
  import { app, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const s = app().site.state;
    return { shown: s.enabled && !!s.link };
  });

  let asking = $state(false);
  let stay = $state();
  const site = () => app().site;

  // Opening the menu again starts fresh.
  $effect(() => {
    const btn = document.getElementById('settings-btn');
    const reset = () => (asking = false);
    btn?.addEventListener('click', reset);
    return () => btn?.removeEventListener('click', reset);
  });
  async function ask(e) {
    e.stopPropagation(); // a question, not an action: keep the menu open
    asking = true;
    await tick();
    stay?.focus({ preventScroll: true });
  }
  function keep(e) {
    e.stopPropagation();
    asking = false;
  }
</script>

{#if d.shown}
  {#if asking}
    <div class="sm-confirm you-confirm warn" role="group" aria-label="Disconnect">
      <b>Disconnect From openhangar.space?</b>
      <span
        >Your synced copy stays on openhangar.space until you delete it there. This extension
        just stops syncing.</span
      >
      <div class="sm-confirm-row">
        <button bind:this={stay} type="button" class="sc-btn" onclick={keep}>Stay Connected</button>
        <button
          type="button"
          class="sc-btn warn menu-item"
          onclick={() => ((asking = false), site().disconnect())}>Disconnect</button
        >
      </div>
    </div>
  {:else}
    <button type="button" class="menu-item menu-warn" id="you-disconnect" onclick={ask}>
      Disconnect From openhangar.space<small>Stops syncing. Your synced copy stays online.</small>
    </button>
  {/if}
{/if}
