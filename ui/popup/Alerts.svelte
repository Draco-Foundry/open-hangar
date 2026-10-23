<script>
  // The bell's Alerts view (the `alerts` build flag; src/alerts.js, self.OHAlerts):
  // what's in RSI's store for you right now, each with why, the ones you hadn't seen
  // yet first. Opening the popup marks them all seen (./Popup.svelte; the background
  // clears the badge). Matched in this browser from the public sale feed; nothing here
  // asks anything. Alerts follow Remind Me (no switch of their own): with it on for nothing, the empty note
  // and its pointer to the Wishlist.
  import { t } from './copy.js';
  import { hideAlert, openTab } from './actions.js';
  import { USD, money } from './currency.js';

  let { alerts, fresh, fx = USD } = $props();
  const AL = globalThis.OHAlerts;
  // The price in the currency picked, the dollar figure on hover.
  const price = (n) => money(n, fx, { most: Number.isInteger(n) ? 0 : 2 });
  const newOnes = $derived(alerts.items.filter((m) => fresh.has(m.id)));
  const earlier = $derived(alerts.items.filter((m) => !fresh.has(m.id)));
  // Past three, the list scrolls in a fixed height so the rest stays put (#699): the box
  // takes a tab stop then, so arrow keys scroll it.
  const many = $derived(alerts.items.length > 3);
  // Deleted here (#701): the background keeps them out for good (src/alerts.js hide)
  // and the list follows its write. Focus goes to the next row's ×, else Clear All's
  // place (the Store button).
  async function remove(id) {
    const rows = [...document.querySelectorAll('#pp-alerts .pp-adel')];
    const at = rows.findIndex((b) => b.dataset.id === id);
    const next = rows[at + 1]?.dataset.id || rows[at - 1]?.dataset.id || null;
    await hideAlert(id);
    setTimeout(() => {
      const to = next && document.querySelector(`#pp-alerts .pp-adel[data-id="${next}"]`);
      (to || document.getElementById('pp-open-store'))?.focus();
    }, 50);
  }
  async function clearAll() {
    await hideAlert(null);
    setTimeout(() => document.getElementById('pp-open-store')?.focus(), 50);
  }
</script>

{#snippet row(m, isNew)}
  {@const why = AL.lines(m).join(' · ')}
  <li class="pp-ali">
    <button type="button" class="pp-arow" class:fresh={isNew} onclick={() => openTab(AL.itemUrl(alerts.feeds, m))}>
      <span class="pp-atext">
        {#if isNew}<span class="pp-sr">{t('popup.alerts-unseen')}</span>{/if}
        <span class="pp-aname" title={m.name}>{m.name}</span>
        {#if why}<small title={why}>{why}</small>{/if}
      </span>
      {#if Number.isFinite(m.price)}{@const p = price(m.price)}<span class="pp-price" title={p.title || null}>{p.text}</span>{/if}
    </button>
    <button
      type="button"
      class="pp-adel"
      data-id={m.id}
      aria-label={t('popup.alerts-delete', { name: m.name })}
      title={t('popup.alerts-delete', { name: m.name })}
      onclick={() => remove(m.id)}
      ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"
        ><path d="M6 6l12 12M18 6L6 18"></path></svg
      ></button
    >
  </li>
{/snippet}

<div class="pp-body pp-alerts" id="pp-alerts">
  {#if alerts.on !== true}
    <p class="pp-note">{t('popup.alerts-none')}</p>
    <p class="pp-note" id="pp-alerts-wish">{t('popup.alerts-wishlist')}</p>
  {:else}
    {#if !alerts.items.length}
      <p class="pp-note">{t('popup.alerts-none')}</p>
    {/if}
    {#if alerts.items.length}
      <div class="pp-atop">
        <button type="button" class="pp-link quiet" id="pp-alerts-clear" onclick={clearAll}
          >{t('popup.alerts-clear')}</button
        >
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="pp-ascroll"
        class:many
        id="pp-ascroll"
        role="region"
        aria-label={t('popup.bell')}
        tabindex={many ? 0 : undefined}
      >
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
      </div>
    {/if}
    {#if !alerts.connected}<p class="pp-note">{t('popup.alerts-connect')}</p>{/if}
    <button type="button" class="pp-btn" id="pp-open-store" onclick={() => openTab(`${alerts.feeds}/store`)}
      >{t('popup.open-store')}</button
    >
  {/if}
</div>
