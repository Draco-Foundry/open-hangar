<script>
  // Connect, wait for approval (the code shown big, to match the website tab), then
  // Connected as <name> with Sync Now, Open ↗, Disconnect (asked once, right here) and
  // Sync After Every Scan. Hidden until the website is switched on (OH.siteEnabled).
  import { app, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const s = app().site.state;
    return {
      enabled: s.enabled,
      link: s.link,
      waiting: s.waiting ? s.waiting.code : '',
      syncing: s.syncing,
      autoSync: s.autoSync,
      msg: s.msg,
    };
  });
  let asking = $state(false); // Disconnect's "are you sure"

  const site = () => app().site;
  function when(t) {
    if (!t) return 'Not synced yet';
    const at = new Date(t);
    const today = at.toDateString() === new Date().toDateString();
    const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `Last synced ${today ? 'today' : at.toLocaleDateString(undefined, { dateStyle: 'medium' })}, ${time}`;
  }
  async function disconnect() {
    asking = false;
    await site().disconnect();
  }
</script>

{#snippet check()}
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M3 8.5l3 3 7-7"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#if d.enabled}
  <div class="site-connect" id="site-connect" aria-live="polite">
    {#if d.waiting}
      <span class="sc-hint">Approve this code on openhangar.space</span>
      <span class="sc-code">{d.waiting}</span>
      <div class="sc-row">
        <button type="button" class="sc-btn quiet" onclick={() => site().reopen()}
          >Open the Page Again ↗</button
        >
        <button type="button" class="sc-btn" onclick={() => site().cancel()}>Cancel</button>
      </div>
      <p class="sc-hint">Spooling the quantum drive… this card updates by itself.</p>
    {:else if d.link && asking}
      <div class="sc-confirm" role="group" aria-label="Disconnect">
        <b>Disconnect From the Website?</b>
        <span class="sc-hint"
          >Your synced copy stays on openhangar.space until you delete it there. This extension
          just stops syncing.</span
        >
        <div class="sc-row">
          <button type="button" class="sc-btn" onclick={() => (asking = false)}
            >Stay Connected</button
          >
          <button type="button" class="sc-btn primary" onclick={disconnect}>Disconnect</button>
        </div>
      </div>
    {:else if d.link}
      <span class="sc-chip">{@render check()}Connected as {d.link.name || 'you'}</span>
      <span class="sc-hint">{d.syncing ? 'Beaming your hangar up…' : when(d.link.lastSync)}</span>
      <div class="sc-row">
        <button
          type="button"
          class="sc-btn primary"
          disabled={d.syncing}
          onclick={() => site().sync()}
          >{#if d.syncing}<span class="sc-spin" aria-hidden="true"></span>Syncing{:else}Sync Now{/if}</button
        >
        <button type="button" class="sc-btn" onclick={() => site().open()}>Open ↗</button>
        {#if !d.syncing}
          <button type="button" class="sc-btn quiet" onclick={() => (asking = true)}
            >Disconnect</button
          >
        {/if}
      </div>
      <label class="sc-toggle">
        <input
          type="checkbox"
          id="site-auto-sync"
          checked={d.autoSync}
          onchange={(e) => site().setAutoSync(e.currentTarget.checked)}
        /><span class="sc-switch" aria-hidden="true"></span>Sync After Every Scan
      </label>
    {:else}
      <button type="button" class="sc-btn primary" onclick={() => site().connect()}
        ><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"
          ><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4" /><path
            d="M1.8 8h12.4M8 1.7c2 2.2 2 10.4 0 12.6M8 1.7c-2 2.2-2 10.4 0 12.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          /></svg
        >Connect to openhangar.space</button
      >
      <p class="sc-hint">
        Optional. See your hangar on any device. Nothing is sent until you press Sync.
      </p>
    {/if}
    {#if d.msg}<p class="sc-msg" role="status">{d.msg}</p>{/if}
  </div>
{/if}
