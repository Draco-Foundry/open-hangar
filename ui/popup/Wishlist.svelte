<script>
  // The Wishlist tab (the privacy policy's "Your Wishlist"): while connected, the
  // account's Wishlist from openhangar.space (./wish-client.js, a copy kept here), and,
  // while the website takes changes from the extension, a search to add a ship, paint or
  // upgrade, and each item's Remove (no Target Price: a ship is on sale or it isn't), and
  // its Remind Me switch while the website offers one (the item has `remind`).
  // The search runs on this device over what the extension already keeps (./wishlist.js: the ship list, and with store
  // alerts on the sale feed); what's typed goes nowhere. Each change is one request, one
  // at a time, only from a click. On Sale and prices come from the sale feed, so only
  // with store alerts on, in the currency picked (the dollar figure on hover). The
  // website not taking changes (a 404): the list read only, as before (the store alerts'
  // copy). Not connected: the way to Connect, which runs on the extension's own page (the
  // browser's sign-in window would close the popup).
  import { onMount, tick } from 'svelte';
  import { t } from './copy.js';
  import { wishRows, wishSale } from './data.js';
  import {
    readWishlist,
    saleFeed,
    searchEntries,
    searchHint,
    searchWish,
    searched,
    shipNames,
  } from './wishlist.js';
  import { WISH_MAX, loadWish, popupEnv, writeWish } from './wish-client.js';
  import { openHub, openTab } from './actions.js';
  import { USD, money } from './currency.js';

  let { connected, fx = USD } = $props();
  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  // { mode: 'edit', items } | { mode: 'rows', rows, unnamed } (read only) | { off: true }
  // | { error: true }
  let list = $state(null);
  let feed = $state(null); // the sale feed, with store alerts on
  let names = $state(null); // ship names by slug (the ship list)
  let q = $state('');
  let busy = $state(false); // a change on its way
  let note = $state('');
  let search = $state();
  const env = popupEnv();

  const sale = $derived(wishSale(feed));
  const entries = $derived(
    list?.mode === 'edit' ? searchEntries({ names, feed, onList: list.items.map((i) => i.key) }) : [],
  );
  const found = $derived(searchWish(entries, q));
  // Searched and nothing matched (once the ship list is read, so never while it loads).
  const nothing = $derived(names != null && searched(q) && !found.length);
  const hint = $derived(t(searchHint(feed)));
  const full = $derived(list?.mode === 'edit' && list.items.length >= WISH_MAX);
  const price = (n) => money(n, fx, { most: Number.isInteger(n) ? 0 : 2 });

  // The read-only list: named from the sale feed, then the ship list.
  async function rowsOf(keys) {
    let rows = wishRows(keys, feed);
    if (rows.unnamed) rows = wishRows(keys, feed, names || (names = await shipNames()));
    return { mode: 'rows', ...rows };
  }
  async function load({ force = false } = {}) {
    if (!connected) return;
    feed = await saleFeed();
    const w = await loadWish(env, { force });
    if (w.mode === 'edit') {
      list = { mode: 'edit', items: w.items };
      if (!names) names = await shipNames();
      return;
    }
    if (w.mode === 'keys') return void (list = await rowsOf(w.keys));
    // The website's Wishlist read didn't answer for the tab: the store alerts' copy, read
    // only, as before; with none, the website (off) or the trouble reaching it.
    const got = await readWishlist();
    if (got.keys) return void (list = await rowsOf(got.keys));
    list = w.mode === 'error' ? { error: true } : { off: true };
  }
  onMount(() => {
    load();
    // The store alerts changed what they keep (the sale feed, their switch), or the
    // connection went.
    const changed = (c, area) => {
      if (area !== 'local' || busy) return;
      if (c.siteLink || (AL && (c[AL.WISH_KEY] || c[AL.FEED_KEY] || c[AL.ON_KEY]))) load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  });
  async function fullList() {
    openTab(`${await OH.siteUrl()}/hangar/wishlist`);
  }

  // One change → what the tab shows after it.
  async function change(c, name) {
    busy = true;
    note = '';
    const r = await writeWish(env, c);
    busy = false;
    if (r.items) list = { mode: 'edit', items: r.items };
    if (r.ok) {
      // Taken, but the answer had no copy of it: the list is read again.
      if (r.stale) await load({ force: true });
      return r;
    }
    if (r.error === 'off') {
      await load({ force: true });
      return r;
    }
    if (r.error === 'refused' && c.do === 'add') note = t('popup.wish-not-added', { name });
    else if (r.outcome !== 'not-found') note = t('popup.wish-trouble');
    return r;
  }
  async function add(e) {
    const r = await change({ do: 'add', item: e.item }, e.name);
    if (r.ok) {
      q = '';
      await tick();
      search?.focus();
    }
  }
  function remove(item) {
    change({ do: 'remove', key: item.key }, item.name);
  }
  function remind(item) {
    change({ do: 'remind', key: item.key, remind: !item.remind }, item.name);
  }
  const KIND_ICON = { ship: 'ship', ccu: 'up', paint: 'paint' };
</script>

{#snippet empty(heading, id = null)}
  <div class="pp-empty" {id}>
    <svg class="pp-big-ic" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"
      ><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg
    >
    <h2 class="pp-h">{heading}</h2>
    <button type="button" class="pp-link" id="pp-wish-full" onclick={fullList}>{t('popup.wish-full')}</button>
  </div>
{/snippet}

{#snippet saleLine(key)}
  {#if sale}
    {@const s = sale(key)}
    <small class:sale={s.onSale}>{s.onSale ? t('popup.wish-on-sale') : t('popup.wish-not-sale')}</small>
  {/if}
{/snippet}

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
  {:else if list?.off}
    {@render empty(t('popup.wish-connect'), 'pp-wish-off')}
  {:else if list?.error}
    {@render empty(t('popup.wish-trouble'))}
  {:else if list?.mode === 'edit'}
    <div class="pp-wsearch" role="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
        ><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg
      >
      <input
        type="search"
        id="pp-wish-q"
        bind:this={search}
        bind:value={q}
        placeholder={hint}
        aria-label={hint}
        aria-controls={found.length ? 'pp-wish-found' : null}
        autocomplete="off"
        spellcheck="false"
        maxlength="80"
        disabled={full}
      />
    </div>
    {#if found.length}
      <ul class="pp-wfound" id="pp-wish-found">
        {#each found as e (e.key)}
          <li>
            <button type="button" class="pp-wadd" disabled={busy} onclick={() => add(e)}>
              <span class="pp-ic" aria-hidden="true">
                {#if KIND_ICON[e.kind] === 'ship'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    ><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"></path></svg
                  >{:else if KIND_ICON[e.kind] === 'up'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    ><path d="M12 19V5M5 12l7-7 7 7"></path></svg
                  >{:else if KIND_ICON[e.kind] === 'paint'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    ><path d="M4 14l6-10 4 7-6 3zM14 11l6 9"></path></svg
                  >{:else}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    ><path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"></path></svg
                  >{/if}
              </span>
              <span class="pp-iname">{e.name}</span>
              <span class="pp-plus" aria-hidden="true">+</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if nothing}
      <p class="pp-note" id="pp-wish-none" role="status">{t('popup.wish-no-match')}</p>
    {/if}
    {#if note}<p class="pp-note" id="pp-wish-note" role="status">{note}</p>{/if}
    {#if list.items.length}
      <h2 class="pp-lbl" id="pp-wish-h">{t('popup.wish-count', { n: list.items.length })}</h2>
      <ul class="pp-wlist pp-wedit" aria-labelledby="pp-wish-h">
        {#each list.items as item (item.key)}
          {@const s = sale ? sale(item.key) : null}
          <li>
            <div class="pp-wrow">
              <span class="pp-atext">
                <span class="pp-aname">{item.name}</span>
                {@render saleLine(item.key)}
              </span>
              {#if s?.onSale && Number.isFinite(s.price)}
                {@const p = price(s.price)}
                <span class="pp-price" title={p.title || null}>{p.text}</span>
              {/if}
              {#if typeof item.remind === 'boolean'}
                <button
                  type="button"
                  class="pp-wsw"
                  role="switch"
                  aria-checked={item.remind ? 'true' : 'false'}
                  aria-label={t('popup.wish-remind', { name: item.name })}
                  title={t('popup.wish-remind-label')}
                  disabled={busy}
                  onclick={() => remind(item)}><span class="pp-wsw-t" aria-hidden="true"></span></button
                >
              {/if}
              <button
                type="button"
                class="pp-wx"
                disabled={busy}
                aria-label={t('popup.wish-remove', { name: item.name })}
                onclick={() => remove(item)}>✕</button
              >
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <h2 class="pp-h pp-wnone">{t('popup.wish-empty')}</h2>
    {/if}
    <button type="button" class="pp-link" id="pp-wish-full" onclick={fullList}>{t('popup.wish-full')}</button>
  {:else if list?.mode === 'rows'}
    {#if !list.rows.length && !list.unnamed}
      {@render empty(t('popup.wish-empty'))}
    {:else}
      <h2 class="pp-lbl" id="pp-wish-h">{t('popup.wish-count', { n: list.rows.length + list.unnamed })}</h2>
      {#if list.rows.length}
        <ul class="pp-wlist" aria-labelledby="pp-wish-h">
          {#each list.rows as r (r.key)}
            <li>
              <span class="pp-atext">
                <span class="pp-aname">{r.name}</span>
                {@render saleLine(r.key)}
              </span>
              {#if sale && r.onSale && Number.isFinite(r.price)}
                {@const p = price(r.price)}
                <span class="pp-price" title={p.title || null}>{p.text}</span>
              {/if}
            </li>
          {/each}
        </ul>
        {#if list.unnamed}<p class="pp-note">{t('popup.wish-more', { n: list.unnamed })}</p>{/if}
      {/if}
      <button type="button" class="pp-link" id="pp-wish-full" onclick={fullList}>{t('popup.wish-full')}</button>
    {/if}
  {/if}
</div>
