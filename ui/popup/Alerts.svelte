<script>
  // The bell's Alerts view (the `alerts` build flag; src/alerts.js, self.OHAlerts):
  // what's in RSI's store for you right now, each with why, the ones you hadn't seen
  // yet first. Opening the popup marks them all seen (./Popup.svelte; the background
  // clears the badge). Matched in this browser from the public sale feed; nothing here
  // asks anything. Alerts off: a heading and Turn On Alerts, the settings' switch.
  import { t } from './copy.js';
  import { openTab, setAlerts } from './actions.js';

  let { alerts, fresh } = $props();
  const AL = globalThis.OHAlerts;
  const money = (n) =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
        })
      : '';
  const newOnes = $derived(alerts.items.filter((m) => fresh.has(m.id)));
  const earlier = $derived(alerts.items.filter((m) => !fresh.has(m.id)));
  let busy = $state(false);
  async function turnOn() {
    busy = true;
    await setAlerts(true);
    busy = false;
  }
</script>

{#snippet row(m, isNew)}
  <li>
    <button type="button" class="pp-arow" class:fresh={isNew} onclick={() => openTab(AL.itemUrl(alerts.feeds, m))}>
      <span class="pp-atext">
        {#if isNew}<span class="pp-sr">{t('popup.alerts-unseen')}</span>{/if}
        <span class="pp-aname">{m.name}</span>
        {#each AL.lines(m) as line}<small>{line}</small>{/each}
      </span>
      {#if Number.isFinite(m.price)}<span class="pp-price">{money(m.price)}</span>{/if}
    </button>
  </li>
{/snippet}

<div class="pp-body pp-alerts" id="pp-alerts">
  {#if alerts.on === false}
    <div class="pp-empty">
      <svg class="pp-big-ic" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"
        ><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10 21a2 2 0 0 0 4 0"></path></svg
      >
      <h2 class="pp-h">{t('popup.alerts-off-title')}</h2>
      <button type="button" class="pp-btn primary" id="pp-alerts-on" disabled={busy} onclick={turnOn}
        >{t('popup.alerts-turn-on')}</button
      >
    </div>
  {:else if alerts.on}
    {#if !alerts.items.length}
      <p class="pp-note">{t('popup.alerts-none')}</p>
    {/if}
    {#if newOnes.length}
      <h2 class="pp-lbl">{t('popup.alerts-new')}</h2>
      <ul class="pp-alist" id="pp-alist-new">
        {#each newOnes as m (m.id)}{@render row(m, true)}{/each}
      </ul>
    {/if}
    {#if earlier.length}
      <h2 class="pp-lbl" class:sep={newOnes.length > 0}>{t('popup.alerts-earlier')}</h2>
      <ul class="pp-alist old" id="pp-alist-old">
        {#each earlier as m (m.id)}{@render row(m, false)}{/each}
      </ul>
    {/if}
    {#if !alerts.connected}<p class="pp-note">{t('popup.alerts-connect')}</p>{/if}
    <button type="button" class="pp-btn" id="pp-open-store" onclick={() => openTab(`${alerts.feeds}/store`)}
      >{t('popup.open-store')}</button
    >
  {/if}
</div>
