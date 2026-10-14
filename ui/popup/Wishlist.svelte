<script>
  // The Wishlist tab: what's on the account's Wishlist (./wishlist.js reads it, ./data.js
  // wishRows names it), read only. Adding, removing and target prices are on the
  // website for now (Full Wishlist ↗). Not connected: the way to Connect, which runs on
  // the extension's own page (the browser's sign-in window would close the popup).
  import { onMount } from 'svelte';
  import { t } from './copy.js';
  import { wishRows } from './data.js';
  import { readWishlist } from './wishlist.js';
  import { openHub, openTab } from './actions.js';

  let { connected } = $props();
  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  let list = $state(null); // { rows, unnamed } | { error: true }
  const money = (n) =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
        })
      : '';

  onMount(async () => {
    if (!connected) return;
    const got = await readWishlist();
    if (got.error) return void (list = { error: true });
    const feed = AL ? (await chrome.storage.local.get(AL.FEED_KEY))[AL.FEED_KEY]?.data : null;
    list = wishRows(got.keys, feed);
  });
  async function full() {
    openTab(`${await OH.siteUrl()}/hangar/wishlist`);
  }
</script>

<div class="pp-body" id="pp-wish">
  {#if !connected}
    <div class="pp-empty">
      <svg class="pp-big-ic" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"
        ><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg
      >
      <h2 class="pp-h">{t('popup.wish-connect')}</h2>
      <button type="button" class="pp-btn primary" id="pp-wish-connect" onclick={() => openHub('#settings')}
        >Connect to openhangar.space</button
      >
    </div>
  {:else if list?.error}
    <div class="pp-empty">
      <h2 class="pp-h">{t('popup.wish-trouble')}</h2>
      <button type="button" class="pp-link" id="pp-wish-full" onclick={full}>{t('popup.wish-full')}</button>
    </div>
  {:else if list}
    {#if !list.rows.length && !list.unnamed}
      <div class="pp-empty">
        <h2 class="pp-h">{t('popup.wish-empty')}</h2>
        <button type="button" class="pp-link" id="pp-wish-full" onclick={full}>{t('popup.wish-full')}</button>
      </div>
    {:else}
      <h2 class="pp-lbl" id="pp-wish-h">{t('popup.wish-count', { n: list.rows.length + list.unnamed })}</h2>
      <ul class="pp-wlist" aria-labelledby="pp-wish-h">
        {#each list.rows as r (r.key)}
          <li>
            <span class="pp-atext">
              <span class="pp-aname">{r.name}</span>
              <small class:sale={r.onSale}>{r.onSale ? t('popup.wish-on-sale') : t('popup.wish-not-sale')}</small>
            </span>
            {#if r.onSale && Number.isFinite(r.price)}<span class="pp-price">{money(r.price)}</span>{/if}
          </li>
        {/each}
      </ul>
      {#if list.unnamed}<p class="pp-note">{t('popup.wish-more', { n: list.unnamed })}</p>{/if}
      <button type="button" class="pp-link" id="pp-wish-full" onclick={full}>{t('popup.wish-full')}</button>
    {/if}
  {/if}
</div>
