<script>
  // Extension Alerts in the popup (the `alerts` build flag; src/alerts.js, self.OHAlerts):
  // what's in RSI's store for you right now, each with why, the ones you hadn't seen yet
  // marked. Opening the popup marks them all seen (the background clears the badge).
  // Matched in this browser from the public sale feed; nothing here asks anything.
  // Alerts off: a line and the way to the settings switch (Notifications are asked for
  // there, in a page that stays open, never in the popup).
  import { onMount } from 'svelte';
  import { t } from './copy.js';

  let { openHub } = $props();
  const AL = globalThis.OHAlerts;
  let on = $state(null);
  let items = $state([]);
  let fresh = $state(new Set());
  let connected = $state(false);
  let feeds = '';
  let first = true;

  async function load() {
    const got = await chrome.storage.local.get([AL.ON_KEY, AL.STATE_KEY, 'siteLink', 'siteUrl']);
    on = got[AL.ON_KEY] === true;
    const state = got[AL.STATE_KEY];
    items = on && Array.isArray(state?.items) ? state.items : [];
    connected = !!got.siteLink?.token;
    feeds = AL.sitesOf(got.siteUrl).feeds;
    // The ones new since you last looked stay marked while the popup is open.
    if (first) {
      first = false;
      fresh = new Set(on ? AL.unseen(state).map((m) => m.id) : []);
      if (fresh.size) chrome.runtime.sendMessage({ ohPopup: 'alerts-seen' }).catch(() => {});
    }
  }
  onMount(() => {
    load();
    const changed = (c, area) => {
      if (area === 'local' && (c[AL.ON_KEY] || c[AL.STATE_KEY] || c.siteLink)) load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  });
  function open(m) {
    chrome.tabs.create({ url: AL.itemUrl(feeds, m) });
    window.close();
  }
</script>

{#if on === false}
  <section class="pp-al" id="pp-alerts">
    <p class="pp-note">{t('popup.alerts-off')}</p>
    <button type="button" class="pp-link" id="pp-alerts-on" onclick={() => openHub('#settings')}
      >{t('popup.alerts-turn-on')}</button
    >
  </section>
{:else if on}
  <section class="pp-al" id="pp-alerts" aria-labelledby="pp-alerts-h">
    <h2 class="pp-lbl" id="pp-alerts-h">
      {items.length ? t('popup.alerts', { n: items.length }) : t('popup.alerts-none')}
    </h2>
    {#if items.length}
      <ul class="pp-alist">
        {#each items as m (m.id)}
          <li class:fresh={fresh.has(m.id)}>
            <button type="button" class="pp-arow" onclick={() => open(m)}>
              {#if fresh.has(m.id)}<span class="pp-sr">{t('popup.alerts-unseen')}</span>{/if}
              <b>{m.name}</b>
              {#each AL.lines(m) as line}<small>{line}</small>{/each}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if !connected}<p class="pp-note">{t('popup.alerts-connect')}</p>{/if}
  </section>
{/if}
