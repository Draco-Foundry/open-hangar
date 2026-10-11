<script>
  // The basic page's settings: openhangar.space (Connect, Sync Now, Disconnect), the
  // store alerts' switch (the `alerts` build flag, ./AlertsCard.svelte), your data
  // (Export JSON, Clear Data), Saved Accounts and Log Out of RSI.
  import { t } from './copy.js';
  import { flag } from '../lib/flags.js';
  import { at } from '../site/when.js';
  import AlertsCard from './AlertsCard.svelte';
  import {
    clearData,
    connect,
    disconnect,
    exportJson,
    hub,
    logOut,
    removeProfile,
    syncNow,
  } from './hub.svelte.js';
  import { download } from './download.js';
  import { exportName } from './rows.js';

  let confirmClear = $state(false);
  let removing = $state(''); // the saved account asked about, before it goes
  let dataNote = $state('');
  const when = (at) =>
    at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  async function backup() {
    const data = await exportJson();
    download(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      exportName('backup', data.account?.handle || hub.owner?.nickname || '', 'json'),
    );
    await chrome.storage.local.set({ lastBackupAt: Date.now() });
    dataNote = t('basic.json-saved');
  }
  async function clear() {
    confirmClear = false;
    await clearData();
  }
</script>

<section class="bp-settings" id="bp-settings" aria-labelledby="bp-settings-h">
  <h2 id="bp-settings-h">{t('basic.tab-settings')}</h2>

  {#if hub.site.enabled}
    <div class="bp-card" id="bp-site">
      <h3>openhangar.space</h3>
      {#if hub.site.link}
        <p>
          {t('basic.connected', { name: hub.site.link.name })}
          <small
            >{hub.site.syncing
              ? t('basic.syncing')
              : hub.site.link.waitUntil
                ? t('basic.sync-wait', { time: at(hub.site.link.waitUntil) })
                : hub.site.link.lastSync
                  ? t('basic.synced', { when: when(hub.site.link.lastSync) })
                  : t('basic.not-synced')}</small
          >
        </p>
        <div class="bp-row">
          <button type="button" class="bp-btn" onclick={() => syncNow()} disabled={hub.site.syncing}
            >Sync Now</button
          >
          <button type="button" class="bp-btn" id="bp-disconnect" onclick={disconnect}
            >Disconnect</button
          >
        </div>
      {:else}
        <p>{t('basic.connect-about')}</p>
        <div class="bp-row">
          <button type="button" class="bp-btn primary" id="bp-connect" onclick={() => connect()}
            >Connect to openhangar.space</button
          >
        </div>
      {/if}
      {#if hub.site.msg}<p class="bp-msg" class:calm={hub.site.calm} role="status">
          {hub.site.msg}
        </p>{/if}
    </div>
  {/if}

  {#if flag('alerts')}<AlertsCard />{/if}

  <div class="bp-card" id="bp-data">
    <h3>{t('basic.your-data')}</h3>
    <p>{t('basic.data-about')}</p>
    <div class="bp-row">
      <button type="button" class="bp-btn" id="bp-export-json" onclick={backup}>Export JSON</button>
      {#if confirmClear}
        <span class="bp-ask" role="group" aria-label="Clear Data">
          {t('basic.clear-ask')}
          <button type="button" class="bp-btn danger" id="bp-clear-yes" onclick={clear}
            >Clear Data</button
          >
          <button type="button" class="bp-btn" onclick={() => (confirmClear = false)}
            >{t('basic.keep-data')}</button
          >
        </span>
      {:else}
        <button type="button" class="bp-btn danger" id="bp-clear" onclick={() => (confirmClear = true)}
          >Clear Data</button
        >
      {/if}
    </div>
    {#if dataNote}<p class="bp-msg" role="status">{dataNote}</p>{/if}
  </div>

  <div class="bp-card" id="bp-accounts">
    <h3>Saved Accounts</h3>
    {#if hub.profiles.length}
      <ul class="bp-accts">
        {#each hub.profiles as p (p.nickname)}
          <li>
            <b>{p.displayname || p.nickname}</b>
            <small>{t('basic.account-line', { n: p.pledges, when: when(p.scannedAt) })}</small>
            {#if p.active}
              <span class="bp-tag">{t('basic.account-live')}</span>
            {:else if removing === p.nickname}
              <span class="bp-ask">
                {t('basic.account-remove-ask')}
                <button
                  type="button"
                  class="bp-link danger"
                  onclick={() => removeProfile(p.nickname).then(() => (removing = ''))}
                  >{t('basic.account-remove')}</button
                >
                <button type="button" class="bp-link" onclick={() => (removing = '')}
                  >{t('basic.keep-data')}</button
                >
              </span>
            {:else}
              <button type="button" class="bp-link" onclick={() => (removing = p.nickname)}
                >{t('basic.account-remove')}</button
              >
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p>{t('basic.no-accounts')}</p>
    {/if}
  </div>

  <div class="bp-card" id="bp-rsi">
    <h3>{t('basic.rsi-session')}</h3>
    <p>{t('basic.logout-about')}</p>
    <div class="bp-row">
      <button type="button" class="bp-btn" id="bp-logout" onclick={logOut}>Log Out of RSI</button>
    </div>
  </div>
</section>
