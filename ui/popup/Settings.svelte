<script>
  // The Settings tab (owner, 2026-10-14; this order 2026-10-24), what the basic page's
  // settings do (ui/basic/Settings.svelte), top to bottom: one openhangar.space box (Sync
  // Now, Disconnect, Daily Scan Reminder, Notifications; Connect opens the extension's own
  // page, since the browser's sign-in window would close the popup), Look, Currency and
  // Shortcut as list rows, Saved Accounts (the privacy policy promises you can remove one
  // here), the Export menu and Log Out of RSI, then Help, Report a Scan Problem and
  // Privacy, and Clear Data on its own line.
  import { onMount, tick } from 'svelte';
  import { t } from './copy.js';
  import { autoLine, popupShortcut, reminderLine, scanAge, syncTrouble } from './data.js';
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
    setAutoDaily,
    setScanReminder,
    syncNow,
  } from './actions.js';

  // `currency`: the one shown (picked, or USD until one is: ./currency.js).
  // `now`: the popup's one clock (./Popup.svelte).
  let { v, busy, failing, prefs, currency, lastReport, now, onlook, oncurrency, onfailed, onnote } =
    $props();
  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  const ALERTS = flag('alerts') && !!AL;
  const SITE = 'https://openhangar.space';
  const VERSION = chrome.runtime.getManifest().version || '';

  let siteOn = $state(false);
  let syncing = $state(false);
  let msg = $state('');
  let calm = $state(false);
  let pilot = $state(null);
  let askDisconnect = $state(false);
  let stay = $state();
  let notify = $state(false);
  let profiles = $state([]);
  let removing = $state('');
  let askClear = $state(false);
  let dataNote = $state('');
  let shortcut = $state(null); // '' none set, null no shortcuts here
  // The Daily Scan Reminder (the `autoScan` flag): its switch (local scanReminderOn) and
  // its last reminder (local scanReminder, written by src/background.js). `denied`: the
  // browser said no to notifications as it was turned on.
  const AUTO = flag('autoScan');
  let autoOn = $state(false);
  let autoRec = $state(null);
  let denied = $state(false);
  const line = $derived(reminderLine({ on: autoOn, rec: autoRec, denied }, now));
  // Auto Scan Daily (the `autoScanRun` flag, beta builds): in place of the reminder,
  // its switch (local autoDailyOn) and its last run's line (local autoDaily, written by
  // ui/scan/runner.js autoScan).
  const DAILY = AUTO && flag('autoScanRun');
  let dailyOn = $state(false);
  let dailyRec = $state(null);
  const dailyLine = $derived(autoLine({ on: dailyOn, rec: dailyRec }, now));

  const trouble = $derived(syncTrouble({ connected: v.connected, failed: failing }, now));
  const ago = (ms) => {
    const a = scanAge(ms, now);
    return a.tone === 'never' ? '' : t(`popup.ago-${a.unit}`, { n: a.n });
  };
  const when = (ms) =>
    ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  async function loadAlerts() {
    if (!ALERTS) return;
    notify = await notifyAllowed();
  }
  // RSI Account Logs (the `accountLogs` flag): a full history load asked for or under
  // way (local accountLogsLoad, src/lib.js readAccountLogs), for the row's line.
  const LOGS = flag('accountLogs');
  let logsLoad = $state(null);
  let logsOn = $state(false); // a log kept or a load asked for
  const logsLine = $derived(
    !logsLoad
      ? ''
      : logsLoad.part && logsLoad.pagecount
        ? t(`popup.account-logs-${logsLoad.part === 'credit' ? 'credit' : 'pledge'}`, {
            page: Math.max(0, (logsLoad.next || 1) - 1),
            pages: logsLoad.pagecount,
          })
        : t('popup.account-logs-asked'),
  );
  async function loadLogs() {
    if (!LOGS) return;
    const got = await chrome.storage.local.get(['accountLogsLoad', 'accountLogs']);
    logsLoad = got.accountLogsLoad || null;
    logsOn = !!(got.accountLogsLoad || got.accountLogs);
  }
  // Ask for the full history and start a scan to read it (it goes on scan by scan).
  async function askLogs() {
    if (!(await OH.wantAccountLogs())) return;
    await loadLogs();
    chrome.runtime.sendMessage({ ohPopup: 'scan' }).catch(() => null);
  }
  // The pilot's off switch (Claude chat's rec, 2026-11-01): off stops the reads and
  // removes the kept logs, so sync sends none; on asks for the full history again.
  async function logsSwitch() {
    if (!logsOn) return askLogs();
    logsOn = false;
    logsLoad = null;
    await OH.stopAccountLogs();
  }
  async function loadAuto() {
    if (!AUTO) return;
    const got = await chrome.storage.local.get(['scanReminderOn', 'scanReminder']);
    autoOn = got.scanReminderOn === true;
    autoRec = got.scanReminder || null;
    if (!DAILY) return;
    const daily = await chrome.storage.local.get(['autoDailyOn', 'autoDaily']);
    dailyOn = daily.autoDailyOn === true;
    dailyRec = daily.autoDaily || null;
  }
  onMount(() => {
    OH.siteEnabled().then((on) => (siteOn = on));
    listProfiles().then((p) => (profiles = p));
    commands().then((c) => (shortcut = popupShortcut(c)));
    loadAlerts();
    loadAuto();
    loadLogs();
    // listProfiles checks every saved hangar, so a run of db writes (a scan) reads it once.
    let later;
    const changed = (c, area) => {
      if (area === 'local' && AUTO && (c.scanReminderOn || c.scanReminder || c.autoDailyOn || c.autoDaily))
        loadAuto();
      if (area === 'local' && LOGS && (c.accountLogsLoad || c.accountLogs)) loadLogs();
      if (area === 'local' && c.db) {
        clearTimeout(later);
        later = setTimeout(() => listProfiles().then((p) => (profiles = p)), 1000);
      }
    };
    chrome.storage.onChanged.addListener(changed);
    return () => {
      chrome.storage.onChanged.removeListener(changed);
      clearTimeout(later);
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
  // On asks for notifications, the click's very first step (Firefox only asks then); the
  // switch is written at once too, for a popup that closes for the question (the worker
  // turns it off again if the answer was no). No: back off, and the line says why.
  function autoSwitch() {
    denied = false;
    if (autoOn) {
      autoOn = false;
      setScanReminder(false);
      return;
    }
    const asked = askNotify();
    autoOn = true;
    setScanReminder(true);
    asked.then(async () => {
      const ok = await notifyAllowed();
      notify = ok;
      if (ok) return;
      autoOn = false;
      denied = true;
      await setScanReminder(false);
    });
  }
  // On asks for notifications, the click's very first step, for the one notice a day it
  // skips; a no still leaves it on (it scans, without the notice).
  function dailySwitch() {
    if (dailyOn) {
      dailyOn = false;
      setAutoDaily(false);
      return;
    }
    const asked = askNotify();
    dailyOn = true;
    setAutoDaily(true);
    asked.then(async () => (notify = await notifyAllowed()));
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
  // The Export menu: a menu button (arrows move, Escape closes back to the button, Tab or
  // a click outside closes it).
  let exportOpen = $state(false);
  let exportBtn = $state();
  let exportMenu = $state();
  const items = () => [...(exportMenu?.querySelectorAll('[role="menuitem"]') || [])];
  async function openExport(at = 0) {
    exportOpen = true;
    await tick();
    items().at(at)?.focus();
  }
  function closeExport(back) {
    exportOpen = false;
    if (back) exportBtn?.focus();
  }
  function exportKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openExport(e.key === 'ArrowUp' ? -1 : 0);
    }
  }
  function menuKey(e) {
    const all = items();
    const i = all.indexOf(document.activeElement);
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: -1 }[e.key];
    if (go != null) {
      e.preventDefault();
      all.at(go % all.length)?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeExport(true);
    } else if (e.key === 'Tab') closeExport(false);
  }
  function outside(e) {
    if (exportOpen && !exportMenu?.contains(e.target) && !exportBtn?.contains(e.target))
      closeExport(false);
  }
  async function pick(run) {
    closeExport(true);
    await run();
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

<svelte:window onclick={outside} />

<div class="pp-body pp-settings" id="pp-settings">
  {#if siteOn}
    <!-- openhangar.space and its switches, in one box. -->
    <div class="pp-grp pp-site" class:warn={siteOn && !!trouble} id="pp-site">
      {#if siteOn && v.connected}
        <div class="pp-r">
          <i class="pp-dot" class:on={!trouble} class:warn={!!trouble} aria-hidden="true"></i>
          <span class="pp-grow pp-cut">{t('popup.connected', { name: v.connected.name })}</span>
          <span class="pp-val"
            >{syncing
              ? t('popup.syncing')
              : v.connected.lastSync
                ? t('popup.synced', { when: ago(v.connected.lastSync) })
                : t('popup.not-synced')}</span
          >
          {#if !pilot && !askDisconnect}
            <!-- Each scan syncs, so Sync Now is a small link beside it; Disconnect another. -->
            <button type="button" class="pp-link" id="pp-sync" disabled={syncing || busy} onclick={sync}
              >{t('popup.sync-now')}</button
            >
            <button type="button" class="pp-link quiet" id="pp-disconnect" onclick={openAsk}>{t('popup.disconnect')}</button>
          {/if}
        </div>
        {#if trouble}
          <div class="pp-r pp-col" id="pp-sync-trouble">
            <b>{t('popup.sync-trouble')}</b>
            <small>{trouble.until ? t('popup.sync-wait', { time: at(trouble.until) }) : trouble.msg}</small>
          </div>
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
          <div class="pp-r pp-col" id="pp-disconnect-ask" role="group" aria-label={t('popup.disconnect')}>
            <b>{t('popup.disconnect-ask')}</b>
            <small>{t('popup.disconnect-body')}</small>
            <div class="pp-pair">
              <button type="button" class="pp-btn2" id="pp-stay" bind:this={stay} onclick={() => (askDisconnect = false)}
                >{t('popup.stay')}</button
              >
              <button type="button" class="pp-btn2 warn" id="pp-disconnect-yes" onclick={leave}>{t('popup.disconnect')}</button>
            </div>
          </div>
        {/if}
        <!-- A failure already under Last Sync Didn't Go Through isn't said twice. -->
        {#if msg && msg !== trouble?.msg}<p class="pp-r pp-msg" class:calm role="status">{msg}</p>{/if}
        {#if DAILY}
          <div class="pp-r pp-col pp-sub">
            <div class="pp-line">
              <span class="pp-grow" id="pp-daily-l">{t('popup.auto-scan')}</span>
              <button
                type="button"
                role="switch"
                class="pp-sw"
                id="pp-daily-sw"
                aria-checked={dailyOn}
                aria-labelledby="pp-daily-l"
                aria-describedby={dailyLine ? 'pp-daily-line' : null}
                onclick={dailySwitch}><i></i></button
              >
            </div>
            <!-- One line (copy.js popup.auto-*, data.js autoLine): the last run; amber when it
                 asks for a scan; none before its first run. -->
            {#if dailyLine}
              <p class="pp-msg" class:calm={!dailyLine.ask} id="pp-daily-line">{t(dailyLine.key, { when: dailyLine.when })}</p>
            {/if}
          </div>
        {:else if AUTO}
          <div class="pp-r pp-col pp-sub">
            <div class="pp-line">
              <span class="pp-grow" id="pp-auto-l">{t('popup.scan-reminder')}</span>
              <button
                type="button"
                role="switch"
                class="pp-sw"
                id="pp-auto-sw"
                aria-checked={autoOn}
                aria-labelledby="pp-auto-l"
                aria-describedby={line ? 'pp-auto-line' : null}
                onclick={autoSwitch}><i></i></button
              >
            </div>
            <!-- One line (copy.js popup.scan-reminder-*, data.js reminderLine): the last reminder
                 or a day skipped; amber when notifications were refused; none otherwise. -->
            {#if line}
              <p class="pp-msg" class:calm={!line.ask} id="pp-auto-line">{t(line.key, { when: line.when })}</p>
            {/if}
          </div>
        {/if}
      {:else if siteOn}
        <div class="pp-r pp-col">
          <button type="button" class="pp-btn primary" id="pp-connect" onclick={() => openHub('#settings')}
            >{t('popup.connect-site')}</button
          >
        </div>
      {/if}
      {#if ALERTS && v.connected}
        <!-- Desktop notifications, the one opt-in left: alerts follow Remind Me, and run only
             while connected (#790), so the switch shows only then (owner, 2026-10-23). -->
        <div class="pp-r pp-col pp-sub" id="pp-alert-set">
          <div class="pp-line">
            <span class="pp-grow" id="pp-nt-l">{t('popup.notifications')}</span>
            <button
              type="button"
              role="switch"
              class="pp-sw"
              id="pp-nt-sw"
              aria-checked={notify}
              aria-labelledby="pp-nt-l"
              onclick={notifySwitch}><i></i></button
            >
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Look, Currency and Shortcut as list rows: the name, then the value (owner, 2026-10-24). -->
  {#if LOGS}
    <!-- RSI Account Logs (the accountLogs flag): its switch (on asks for the full history,
         which the next scan reads page by page and goes on where it stopped; off stops and
         removes the logs), and, while on, Load Full History to read it all again
         (src/lib.js readAccountLogs, stopAccountLogs). -->
    <div class="pp-grp" id="pp-logs">
      <div class="pp-r pp-col">
        <div class="pp-line">
          <span class="pp-grow" id="pp-logs-l">{t('popup.account-logs')}</span>
          {#if logsOn && !logsLoad}
            <button type="button" class="pp-btn2" id="pp-logs-load" onclick={askLogs}
              >{t('popup.account-logs-load')}</button
            >
          {/if}
          <button
            type="button"
            role="switch"
            class="pp-sw"
            id="pp-logs-sw"
            aria-checked={logsOn}
            aria-labelledby="pp-logs-l"
            aria-describedby={logsLine ? 'pp-logs-line' : null}
            onclick={logsSwitch}><i></i></button
          >
        </div>
        {#if logsLine}<p class="pp-msg calm" id="pp-logs-line" role="status">{logsLine}</p>{/if}
      </div>
    </div>
  {/if}

  <div class="pp-grp" id="pp-prefs">
    <label class="pp-r pp-li">
      <span class="pp-grow">{t('popup.look')}</span>
      <span class="pp-pick"
        ><select class="pp-sel" id="pp-look" value={prefs.look} onchange={(e) => onlook(e.currentTarget.value)}>
          {#each LOOKS as l (l)}<option value={l}>{t(LOOK[l])}</option>{/each}
        </select></span
      >
    </label>
    <label class="pp-r pp-li">
      <span class="pp-grow">{t('popup.currency')}</span>
      <span class="pp-pick"
        ><select class="pp-sel" id="pp-currency" value={currency} onchange={(e) => oncurrency(e.currentTarget.value)}>
          {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
        </select></span
      >
    </label>
    {#if shortcut != null}
      <div class="pp-r pp-li">
        <span class="pp-grow" id="pp-shortcut-l">{t('popup.shortcut')}</span>
        <!-- Where the browser lets you change it, the value opens its shortcuts page. -->
        {#if canChangeShortcut()}
          <button
            type="button"
            class="pp-pick go"
            id="pp-shortcut"
            aria-labelledby="pp-shortcut-l pp-shortcut"
            onclick={openShortcuts}>{shortcut || t('popup.shortcut-none')}</button
          >
        {:else}
          <span class="pp-pick fixed" id="pp-shortcut">{shortcut || t('popup.shortcut-none')}</span>
        {/if}
      </div>
    {/if}
  </div>

  {#if profiles.length}
    <div class="pp-grp" id="pp-accounts" role="group" aria-labelledby="pp-accounts-h">
      <h2 class="pp-r pp-gh" id="pp-accounts-h">{t('popup.saved-accounts')}</h2>
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

  <!-- The Export menu (JSON Backup, Pledges CSV, Buy-Backs CSV) next to Log Out of RSI. -->
  <div class="pp-pair pp-data">
    <div class="pp-menu">
      <button
        type="button"
        class="pp-btn2"
        id="pp-export"
        aria-haspopup="menu"
        aria-expanded={exportOpen}
        aria-controls="pp-export-menu"
        bind:this={exportBtn}
        onclick={() => (exportOpen ? closeExport(false) : openExport())}
        onkeydown={exportKey}>{t('popup.export-menu')}</button
      >
      {#if exportOpen}
        <div
          class="pp-mlist"
          id="pp-export-menu"
          role="menu"
          tabindex="-1"
          aria-labelledby="pp-export"
          bind:this={exportMenu}
          onkeydown={menuKey}
        >
          <button type="button" role="menuitem" tabindex="-1" id="pp-export-json" onclick={() => pick(backup)}
            >{t('popup.export-json')}</button
          >
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            id="pp-export-pledges"
            onclick={() => pick(() => csv('pledges'))}>{t('popup.export-pledges')}</button
          >
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            id="pp-export-buybacks"
            onclick={() => pick(() => csv('buybacks'))}>{t('popup.export-buybacks')}</button
          >
        </div>
      {/if}
    </div>
    <button type="button" class="pp-btn2 quiet" id="pp-logout" onclick={signOut}>{t('popup.log-out')}</button>
  </div>
  {#if dataNote}<p class="pp-note" role="status">{dataNote}</p>{/if}

  <nav class="pp-links">
    <button type="button" class="pp-link" onclick={() => openTab(`${SITE}/help.html`)}>{t('popup.help')}</button>
    <button type="button" class="pp-link" id="pp-report-problem" onclick={() => reportProblem(lastReport)}
      >{t('popup.report-problem')}</button
    >
    <button type="button" class="pp-link" onclick={() => openTab(`${SITE}/privacy.html`)}>{t('popup.privacy')}</button>
  </nav>

  <!-- Clear Data on its own line, away from the everyday buttons; it asks first. -->
  {#if askClear}
    <div class="pp-grp warn" id="pp-clear-ask" role="group" aria-label={t('popup.clear-data')}>
      <div class="pp-r pp-col">
        <small>{t('popup.clear-ask')}</small>
        <div class="pp-pair">
          <button type="button" class="pp-btn2 warn" id="pp-clear-yes" disabled={busy} onclick={clear}>{t('popup.clear-data')}</button>
          <button type="button" class="pp-btn2" onclick={() => (askClear = false)}>{t('popup.keep-data')}</button>
        </div>
      </div>
    </div>
  {:else}
    <div class="pp-end">
      <button type="button" class="pp-link bad" id="pp-clear" disabled={busy} onclick={() => (askClear = true)}
        >{t('popup.clear-data')}</button
      >
    </div>
  {/if}
  <!-- The version, here instead of the header (owner, 2026-10-23). -->
  <p class="pp-version" id="pp-version">v{VERSION}</p>
</div>
