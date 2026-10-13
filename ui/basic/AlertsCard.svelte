<script>
  // The store alerts' switch in the basic page's settings (the `alerts` build flag;
  // src/alerts.js, self.OHAlerts). Off until the pilot turns it on. Turning it on asks
  // for Notifications, the one optional permission (owner, 2026-10-10): the browser asks
  // in its own words, and a no still leaves the badge and the popup's list. Turning it
  // off stops the checks (src/background.js), drops the matches and the Wishlist keys,
  // and gives Notifications back. The checks run in the background, not here.
  import { onMount } from 'svelte';
  import { t } from './copy.js';

  const AL = globalThis.OHAlerts;
  const NOTIFY = { permissions: ['notifications'] };
  let on = $state(null);
  let allowed = $state(false);
  let count = $state(0);
  let checkedAt = $state(null);
  let trouble = $state(false);
  let connected = $state(false);
  let busy = $state(false);

  async function load() {
    const got = await chrome.storage.local.get([AL.ON_KEY, AL.STATE_KEY, AL.FEED_KEY, 'siteLink']);
    on = got[AL.ON_KEY] === true;
    allowed = await chrome.permissions.contains(NOTIFY).catch(() => false);
    count = Array.isArray(got[AL.STATE_KEY]?.items) ? got[AL.STATE_KEY].items.length : 0;
    checkedAt = Number.isFinite(got[AL.STATE_KEY]?.checkedAt) ? got[AL.STATE_KEY].checkedAt : null;
    trouble = (got[AL.FEED_KEY]?.fails || 0) > 0;
    connected = !!got.siteLink?.token;
  }
  onMount(() => {
    load();
    const changed = (c, area) => {
      if (area === 'local' && (c[AL.ON_KEY] || c[AL.STATE_KEY] || c[AL.FEED_KEY] || c.siteLink))
        load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  });

  // The browser only asks from a click, and Firefox only when the ask is the click's
  // very first step: nothing is awaited before it.
  function ask() {
    return chrome.permissions.request(NOTIFY).catch(() => false);
  }
  function turnOn() {
    busy = true;
    ask()
      .then(() => chrome.storage.local.set({ [AL.ON_KEY]: true }))
      .then(load)
      .finally(() => (busy = false));
  }
  function allow() {
    ask().then(load);
  }
  async function turnOff() {
    busy = true;
    await chrome.storage.local.set({ [AL.ON_KEY]: false });
    await chrome.permissions.remove(NOTIFY).catch(() => false);
    await load();
    busy = false;
  }
  const when = (at) =>
    new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<div class="bp-card" id="bp-alerts">
  <h3>{t('basic.alerts-title')}</h3>
  <p>{t('basic.alerts-about')}</p>
  {#if on}
    <p>
      {t('basic.alerts-on-line', { n: count })}
      {#if checkedAt}<small>{t('basic.alerts-checked', { when: when(checkedAt) })}</small>{/if}
    </p>
    <p id="bp-alerts-notify">
      {allowed ? t('basic.alerts-notify-on') : t('basic.alerts-notify-off')}
    </p>
    <p>{connected ? t('basic.alerts-wishlist-on') : t('basic.alerts-wishlist-connect')}</p>
    {#if trouble}<p class="bp-msg calm" role="status">{t('basic.alerts-trouble')}</p>{/if}
    <div class="bp-row">
      {#if !allowed}
        <button type="button" class="bp-btn" id="bp-alerts-allow" onclick={allow}
          >{t('basic.alerts-allow')}</button
        >
      {/if}
      <button type="button" class="bp-btn" id="bp-alerts-off" onclick={turnOff} disabled={busy}
        >{t('basic.alerts-turn-off')}</button
      >
    </div>
  {:else if on === false}
    <div class="bp-row">
      <button
        type="button"
        class="bp-btn primary"
        id="bp-alerts-on"
        onclick={turnOn}
        disabled={busy}>{t('basic.alerts-turn-on')}</button
      >
    </div>
  {/if}
</div>
