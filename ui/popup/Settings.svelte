<script>
  // The Settings tab (owner, 2026-10-14), what the basic page's settings do
  // (ui/basic/Settings.svelte), grouped: openhangar.space (Sync Now, Disconnect;
  // Connect opens the extension's own page, since the browser's sign-in window would
  // close the popup), the store alerts' switches, Look, Currency and the shortcut, the
  // data buttons, Saved Accounts (the privacy policy promises you can remove one here),
  // Log Out of RSI and Clear Data, then Help, Report a Scan Problem and Privacy.
  import { onMount, tick } from 'svelte';
  import { t } from './copy.js';
  import { popupShortcut, scanAge, syncTrouble } from './data.js';
  import { CURRENCIES, LOOKS } from './prefs.js';
  import { at } from '../site/when.js';
  import { flag } from '../lib/flags.js';
  import {
    askNotify,
    canChangeShortcut,
    clearData,
    commands,
    disconnect,
    dropNotify,
    exportBuybacksCsv,
    exportJson,
    exportPledgesCsv,
    listProfiles,
    logOut,
    notifyAllowed,
    openHub,
    openShortcuts,
    openTab,
    pilotAnswer,
    reportProblem,
    removeProfile,
    setAlerts,
    syncNow,
  } from './actions.js';

  // `currency`: the one shown (picked, or the browser's language's: ./currency.js).
  let { v, busy, failing, prefs, currency, lastReport, onlook, oncurrency, onfailed, onnote } =
    $props();
  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  const ALERTS = flag('alerts') && !!AL;
  const SITE = 'https://openhangar.space';

  let siteOn = $state(false);
  let syncing = $state(false);
  let msg = $state('');
  let calm = $state(false);
  let pilot = $state(null);
  let askDisconnect = $state(false);
  let stay = $state();
  let alertsOn = $state(null);
  let notify = $state(false);
  let profiles = $state([]);
  let removing = $state('');
  let askClear = $state(false);
  let dataNote = $state('');
  let shortcut = $state(null); // '' none set, null no shortcuts here
  let now = $state(Date.now());

  const trouble = $derived(syncTrouble({ connected: v.connected, failed: failing }, now));
  const ago = (ms) => {
    const a = scanAge(ms, now);
    return a.tone === 'never' ? '' : t(`popup.ago-${a.unit}`, { n: a.n });
  };
  const when = (ms) =>
    ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  async function loadAlerts() {
    if (!ALERTS) return;
    alertsOn = (await chrome.storage.local.get(AL.ON_KEY))[AL.ON_KEY] === true;
    notify = await notifyAllowed();
  }
  onMount(() => {
    OH.siteEnabled().then((on) => (siteOn = on));
    listProfiles().then((p) => (profiles = p));
    commands().then((c) => (shortcut = popupShortcut(c)));
    loadAlerts();
    const changed = (c, area) => {
      if (area === 'local' && ALERTS && c[AL.ON_KEY]) loadAlerts();
      if (area === 'local' && c.db) listProfiles().then((p) => (profiles = p));
    };
    chrome.storage.onChanged.addListener(changed);
    const clock = setInterval(() => (now = Date.now()), 15e3);
    return () => {
      chrome.storage.onChanged.removeListener(changed);
      clearInterval(clock);
    };
  });

  function shown(r) {
    msg = r.msg || '';
    calm = !!r.calm;
    pilot = r.pilot || null;
    onfailed(r.msg && !r.calm ? { msg: r.msg } : null);
  }
  async function sync() {
    syncing = true;
    shown({});
    shown(await syncNow());
    syncing = false;
  }
  async function answer(yes) {
    const who = pilot;
    pilot = null;
    syncing = yes;
    shown(await pilotAnswer(who, yes));
    syncing = false;
  }
  async function openAsk() {
    askDisconnect = true;
    await tick();
    stay?.focus();
  }
  async function leave() {
    askDisconnect = false;
    shown({});
    await disconnect().catch((e) => (msg = String(e?.message || e)));
  }
  async function alertsSwitch() {
    const on = !alertsOn;
    alertsOn = on;
    await setAlerts(on);
    if (!on) notify = false;
  }
  function notifySwitch() {
    if (notify) {
      notify = false;
      dropNotify();
      return;
    }
    // The ask is the click's very first step (Firefox only asks then).
    askNotify().then(async () => (notify = await notifyAllowed()));
  }
  async function backup() {
    await exportJson();
    dataNote = t('popup.json-saved');
  }
  async function csv(what) {
    const n = await (what === 'buybacks' ? exportBuybacksCsv() : exportPledgesCsv());
    dataNote = t('popup.csv-saved', { n });
  }
  async function signOut() {
    const r = await logOut();
    dataNote = r.ok ? t('popup.logged-out') : r.error || t('popup.logout-failed');
  }
  // Clear Data: nothing scanned is left, so the popup goes back to its first view (no
  // tabs), which says so under Scan.
  async function clear() {
    askClear = false;
    await clearData();
    onnote?.(t('popup.cleared'));
    profiles = await listProfiles();
    dataNote = t('popup.cleared');
  }
  async function forget(nickname) {
    await removeProfile(nickname);
    removing = '';
    profiles = await listProfiles();
  }
  const LOOK = { auto: 'popup.look-auto', dark: 'popup.look-dark', light: 'popup.look-light' };
</script>

<div class="pp-body pp-settings" id="pp-settings">
  {#if siteOn}
    <div class="pp-grp pp-site" class:warn={!!trouble} id="pp-site">
      {#if v.connected}
        <div class="pp-r">
          <i class="pp-dot" class:on={!trouble} class:warn={!!trouble} aria-hidden="true"></i>
          <span class="pp-grow">{t('popup.connected', { name: v.connected.name })}</span>
          <span class="pp-val"
            >{syncing
              ? t('popup.syncing')
              : v.connected.lastSync
                ? t('popup.synced', { when: ago(v.connected.lastSync) })
                : t('popup.not-synced')}</span
          >
        </div>
        {#if trouble}
          <div class="pp-r pp-col" id="pp-sync-trouble">
            <b>{t('popup.sync-trouble')}</b>
            <small>{trouble.until ? t('popup.sync-wait', { time: at(trouble.until) }) : trouble.msg}</small>
          </div>
        {/if}
        {#if flag('autoScan')}
          <div class="pp-r">
            <span class="pp-grow" id="pp-auto-l">{t('popup.auto-scan')}</span>
            <button type="button" role="switch" class="pp-sw" aria-checked="false" aria-labelledby="pp-auto-l" disabled
              ><i></i></button
            >
          </div>
          <!-- Its status line (copy.js popup.auto-*): before its first run, for now. -->
          <p class="pp-r pp-msg calm" id="pp-auto-line">{t('popup.auto-first')}</p>
        {/if}
        {#if pilot}
          <div class="pp-r pp-col" id="pp-pilot" role="group" aria-labelledby="pp-pilot-h">
            <b id="pp-pilot-h">{t('popup.pilot-title', { handle: pilot.handle })}</b>
            <small>{t('popup.pilot-body')}</small>
            <div class="pp-pair">
              <button type="button" class="pp-btn2" onclick={() => answer(true)}>{t('popup.pilot-yes')}</button>
              <button type="button" class="pp-btn2" onclick={() => answer(false)}>{t('popup.pilot-no')}</button>
            </div>
          </div>
        {:else if askDisconnect}
          <!-- The dashboard's question, word for word (ui/site/YouDisconnect.svelte). -->
          <div class="pp-r pp-col" id="pp-disconnect-ask" role="group" aria-label="Disconnect">
            <b>{t('popup.disconnect-ask')}</b>
            <small>{t('popup.disconnect-body')}</small>
            <div class="pp-pair">
              <button type="button" class="pp-btn2" id="pp-stay" bind:this={stay} onclick={() => (askDisconnect = false)}
                >{t('popup.stay')}</button
              >
              <button type="button" class="pp-btn2 warn" id="pp-disconnect-yes" onclick={leave}>Disconnect</button>
            </div>
          </div>
        {:else}
          <div class="pp-r pp-pair">
            <button type="button" class="pp-btn2" id="pp-sync" disabled={syncing || busy} onclick={sync}>Sync Now</button>
            <button type="button" class="pp-btn2 quiet" id="pp-disconnect" onclick={openAsk}>Disconnect</button>
          </div>
        {/if}
        <!-- A failure already under Last Sync Didn't Go Through isn't said twice. -->
        {#if msg && msg !== trouble?.msg}<p class="pp-r pp-msg" class:calm role="status">{msg}</p>{/if}
      {:else}
        <div class="pp-r pp-col">
          <b>openhangar.space</b>
          <button type="button" class="pp-btn primary" id="pp-connect" onclick={() => openHub('#settings')}
            >Connect to openhangar.space</button
          >
        </div>
      {/if}
    </div>
  {/if}

  {#if ALERTS && alertsOn != null}
    <div class="pp-grp" id="pp-alert-set">
      <div class="pp-r">
        <span class="pp-grow" id="pp-al-l">{t('popup.store-alerts')}</span>
        <button
          type="button"
          role="switch"
          class="pp-sw"
          id="pp-al-sw"
          aria-checked={alertsOn}
          aria-labelledby="pp-al-l"
          onclick={alertsSwitch}><i></i></button
        >
      </div>
      <div class="pp-r">
        <span class="pp-grow" id="pp-nt-l">{t('popup.notifications')}</span>
        <button
          type="button"
          role="switch"
          class="pp-sw"
          id="pp-nt-sw"
          aria-checked={notify}
          aria-labelledby="pp-nt-l"
          disabled={!alertsOn}
          onclick={notifySwitch}><i></i></button
        >
      </div>
    </div>
  {/if}

  <div class="pp-grp">
    <label class="pp-r">
      <span class="pp-grow">{t('popup.look')}</span>
      <select class="pp-sel" id="pp-look" value={prefs.look} onchange={(e) => onlook(e.currentTarget.value)}>
        {#each LOOKS as l (l)}<option value={l}>{t(LOOK[l])}</option>{/each}
      </select>
    </label>
    <label class="pp-r">
      <span class="pp-grow">{t('popup.currency')}</span>
      <select class="pp-sel" id="pp-currency" value={currency} onchange={(e) => oncurrency(e.currentTarget.value)}>
        {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
    </label>
    {#if shortcut != null}
      <div class="pp-r">
        <span class="pp-grow">{t('popup.shortcut')}</span>
        <span class="pp-val" id="pp-shortcut">{shortcut || t('popup.shortcut-none')}</span>
        {#if canChangeShortcut()}
          <button type="button" class="pp-link" id="pp-shortcut-change" onclick={openShortcuts}
            >{t('popup.shortcut-change')}</button
          >
        {/if}
      </div>
    {/if}
  </div>

  <div class="pp-pair pp-three">
    <button type="button" class="pp-btn2" id="pp-export-json" onclick={backup}>{t('popup.export-json')}</button>
    <button type="button" class="pp-btn2" id="pp-export-pledges" onclick={() => csv('pledges')}
      >{t('popup.export-pledges')}</button
    >
    <button type="button" class="pp-btn2" id="pp-export-buybacks" onclick={() => csv('buybacks')}
      >{t('popup.export-buybacks')}</button
    >
  </div>

  {#if profiles.length}
    <div class="pp-grp" id="pp-accounts" role="group" aria-labelledby="pp-accounts-h">
      <h2 class="pp-r pp-gh" id="pp-accounts-h">Saved Accounts</h2>
      {#each profiles as p (p.nickname)}
        <div class="pp-r">
          <span class="pp-grow pp-acct"
            ><b>{p.displayname || p.nickname}</b><small
              >{t('popup.account-line', { n: p.pledges, when: when(p.scannedAt) })}</small
            ></span
          >
          {#if p.active}
            <span class="pp-tag">{t('popup.account-live')}</span>
          {:else if removing === p.nickname}
            <span class="pp-ask">
              <small>{t('popup.account-remove-ask')}</small>
              <span class="pp-row">
                <button type="button" class="pp-link warn" disabled={busy} onclick={() => forget(p.nickname)}
                  >{t('popup.account-remove')}</button
                >
                <button type="button" class="pp-link" onclick={() => (removing = '')}>{t('popup.keep-data')}</button>
              </span>
            </span>
          {:else}
            <button type="button" class="pp-link" disabled={busy} onclick={() => (removing = p.nickname)}
              >{t('popup.account-remove')}</button
            >
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if askClear}
    <div class="pp-grp warn" id="pp-clear-ask" role="group" aria-label="Clear Data">
      <div class="pp-r pp-col">
        <small>{t('popup.clear-ask')}</small>
        <div class="pp-pair">
          <button type="button" class="pp-btn2 warn" id="pp-clear-yes" disabled={busy} onclick={clear}>Clear Data</button>
          <button type="button" class="pp-btn2" onclick={() => (askClear = false)}>{t('popup.keep-data')}</button>
        </div>
      </div>
    </div>
  {:else}
    <div class="pp-pair">
      <button type="button" class="pp-btn2 quiet" id="pp-logout" onclick={signOut}>Log Out of RSI</button>
      <button type="button" class="pp-btn2 warn" id="pp-clear" disabled={busy} onclick={() => (askClear = true)}
        >Clear Data</button
      >
    </div>
  {/if}
  {#if dataNote}<p class="pp-note" role="status">{dataNote}</p>{/if}

  <nav class="pp-links">
    <button type="button" class="pp-link" onclick={() => openTab(`${SITE}/help.html`)}>{t('popup.help')}</button>
    <button type="button" class="pp-link" id="pp-report-problem" onclick={() => reportProblem(lastReport)}
      >Report a Scan Problem</button
    >
    <button type="button" class="pp-link" onclick={() => openTab(`${SITE}/privacy.html`)}>{t('popup.privacy')}</button>
  </nav>
</div>
