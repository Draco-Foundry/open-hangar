<script>
  // First-run setup (the `firstRun` flag; mockup v2, owner 2026-11-15): the basic page at
  // #setup, opened once on a fresh install (src/background.js). Four steps, Skip on each:
  // Welcome; Before You Connect (./FirefoxCard.svelte, its approved words, on every
  // browser) with the opt-in switches, each off until the pilot turns it on; Connect
  // (openhangar.space and the RSI sign-in, each shown done when it is); First Scan, which
  // the pilot starts. Not Now on Before You Connect is Local Mode: nothing is sent, and
  // it goes straight to First Scan. Finished or skipped, `setupDone` is kept and the page
  // never opens again. The switches are the popup's (ui/lib/OptInRow.svelte), with the
  // popup's words, and do what the popup's Settings tab does.
  import { onMount } from 'svelte';
  import { t } from './copy.js';
  import { t as pt } from '../popup/copy.js';
  import { flag } from '../lib/flags.js';
  import OptInRow from '../lib/OptInRow.svelte';
  import FirefoxCard from './FirefoxCard.svelte';
  import { connect, hub, scanClick, setupAgree } from './hub.svelte.js';

  const OH = globalThis.OH;
  const FIREFOX = !!chrome.runtime.getManifest().browser_specific_settings?.gecko;
  const NOTIFY = { permissions: ['notifications'] };
  const DAILY = flag('autoScanRun') && flag('autoScan');
  const ALERTS = flag('alerts');
  const LOGS = flag('accountLogs');
  const ORDERS = flag('orderHistory');
  const RSI_SIGN_IN = 'https://robertsspaceindustries.com/connect';

  let step = $state('welcome'); // welcome | consent | connect | scan
  let local = $state(false); // Not Now on Before You Connect: Local Mode
  let started = $state(false); // First Scan pressed
  let daily = $state(false);
  let notify = $state(false);
  let logs = $state(false);
  let orders = $state(false);
  let tip = $state(''); // the switch whose tip is open

  const linked = $derived(!!hub.site.link);
  const signedIn = $derived(!!hub.account?.loggedIn);
  const scanned = $derived(
    started && !hub.scan.busy && !!hub.scan.report && !hub.scan.report.bad && !hub.scan.report.signedOut,
  );
  const hangarUrl = $derived(
    linked && hub.site.url
      ? `${hub.site.url}/hangar`
      : (globalThis.OHPages?.pages?.hangar?.[0] || '') && `${globalThis.OHPages.pages.hangar[0]}/`,
  );

  onMount(async () => {
    const got = await chrome.storage.local.get([
      'autoDailyOn',
      'accountLogsLoad',
      'accountLogs',
      'orderHistoryOn',
    ]);
    daily = got.autoDailyOn === true;
    logs = !!(got.accountLogsLoad || got.accountLogs);
    orders = Number.isFinite(got.orderHistoryOn) && got.orderHistoryOn > 0;
    notify = await chrome.permissions.contains(NOTIFY).catch(() => false);
  });

  // Setup is done (finished or skipped): it never opens again.
  async function finish() {
    await chrome.storage.local.set({ setupDone: { at: Date.now() } });
  }
  async function skip() {
    await finish();
    location.hash = '';
  }

  // The switches, as the popup's Settings tab does them (ui/popup/Settings.svelte). The
  // notifications ask is the click's very first step (Firefox only asks then).
  function dailySwitch() {
    daily = !daily;
    if (daily && !notify)
      chrome.permissions
        .request(NOTIFY)
        .catch(() => false)
        .then((ok) => (notify = !!ok));
    chrome.storage.local.set({ autoDailyOn: daily });
  }
  function notifySwitch() {
    if (notify) {
      notify = false;
      chrome.permissions.remove(NOTIFY).catch(() => false);
      return;
    }
    chrome.permissions
      .request(NOTIFY)
      .catch(() => false)
      .then((ok) => (notify = !!ok));
  }
  async function logsSwitch() {
    logs = !logs;
    if (logs) logs = !!(await OH.wantAccountLogs());
    else await OH.stopAccountLogs();
  }
  async function ordersSwitch() {
    orders = !orders;
    await OH.setOrderHistory(orders);
  }

  // Before You Connect's Continue: the click that agrees (and Firefox's ask).
  async function agree() {
    const asked = setupAgree();
    await asked;
    local = false;
    step = 'connect';
  }
  function notNow() {
    local = true;
    step = 'scan';
  }
  function scanNow() {
    started = true;
    scanClick();
  }
  async function openHangar() {
    await finish();
    if (hangarUrl) location.assign(hangarUrl);
  }
  const showTip = (id) => (tip = tip === id ? '' : id);
</script>

<section class="bp-card bp-setup" id="bp-setup" aria-labelledby="bp-setup-h">
  <div class="bp-row bp-setup-top">
    <ol class="bp-steps" aria-hidden="true">
      {#each ['welcome', 'consent', 'connect', 'scan'] as s, i (s)}
        <li class:on={['welcome', 'consent', 'connect', 'scan'].indexOf(step) >= i}></li>
      {/each}
    </ol>
    <button type="button" class="bp-link" id="bp-setup-skip" onclick={skip}>{t('setup.skip')}</button>
  </div>

  {#if step === 'welcome'}
    <h2 id="bp-setup-h">{t('setup.welcome')}</h2>
    <p>{t('setup.about')}</p>
    <div class="bp-row">
      <button type="button" class="bp-btn primary" id="bp-setup-next" onclick={() => (step = 'consent')}
        >{t('setup.next')}</button
      >
    </div>
  {:else if step === 'consent'}
    <h2 id="bp-setup-h">{t('setup.what')}</h2>
    <div class="bp-opts" role="group" aria-labelledby="bp-setup-h">
      {#if DAILY}
        <OptInRow
          id="bp-daily"
          label={pt('popup.auto-scan')}
          on={daily}
          onclick={dailySwitch}
          tip={t('setup.tip-auto')}
          tipOpen={tip === 'daily'}
          ontip={() => showTip('daily')}
        >
          {#if !linked}<p class="pp-msg calm">{t('setup.needs-link')}</p>{/if}
        </OptInRow>
      {/if}
      {#if ALERTS}
        <OptInRow
          id="bp-nt"
          label={pt('popup.notifications')}
          on={notify}
          onclick={notifySwitch}
          tip={t('setup.tip-notify')}
          tipOpen={tip === 'notify'}
          ontip={() => showTip('notify')}
        />
      {/if}
      {#if LOGS}
        <OptInRow
          id="bp-logs"
          label={pt('popup.account-logs')}
          on={logs}
          onclick={logsSwitch}
          tip={t('setup.tip-logs')}
          tipOpen={tip === 'logs'}
          ontip={() => showTip('logs')}
        >
          <p class="pp-msg calm">{pt('popup.account-logs-first-scan')}</p>
        </OptInRow>
      {/if}
      {#if ORDERS}
        <OptInRow
          id="bp-orders"
          label={pt('popup.order-history')}
          on={orders}
          onclick={ordersSwitch}
          tip={t('setup.tip-orders')}
          tipOpen={tip === 'orders'}
          ontip={() => showTip('orders')}
        >
          <p class="pp-msg calm">{pt('popup.order-history-first-scan')}</p>
        </OptInRow>
      {/if}
    </div>
    <FirefoxCard firefox={FIREFOX} onContinue={agree} onClose={notNow} />
  {:else if step === 'connect'}
    <h2 id="bp-setup-h">{t('setup.connect')}</h2>
    <ul class="bp-checks">
      <li>
        <span class="bp-dot" class:on={linked}></span>openhangar.space
        {#if linked}<small>{t('basic.connected', { name: hub.site.link.name })}</small>
        {:else}<button type="button" class="bp-btn primary" id="bp-setup-connect" onclick={() => connect()}
            >{pt('popup.connect-site')}</button
          >{/if}
      </li>
      <li>
        <span class="bp-dot" class:on={signedIn}></span>RSI
        {#if signedIn}<small>{pt('popup.account-live')}</small>
        {:else}<a class="bp-btn" id="bp-setup-rsi" href={RSI_SIGN_IN} target="_blank" rel="noopener"
            >{pt('popup.log-in')}</a
          >{/if}
      </li>
    </ul>
    <div class="bp-row">
      <button type="button" class="bp-link" onclick={() => (step = 'consent')}>{t('setup.back')}</button>
      <button type="button" class="bp-btn primary" id="bp-setup-to-scan" onclick={() => (step = 'scan')}
        >{t('setup.next')}</button
      >
    </div>
  {:else if scanned}
    <h2 id="bp-setup-h">{t('setup.done')}</h2>
    <div class="bp-row">
      {#if hangarUrl}<button type="button" class="bp-btn primary" id="bp-setup-hangar" onclick={openHangar}
          >{pt('popup.open-my-hangar')}</button
        >{:else}<button type="button" class="bp-btn primary" onclick={skip}>{t('setup.next')}</button>{/if}
    </div>
  {:else}
    <h2 id="bp-setup-h">{t('setup.scan')}</h2>
    <div class="bp-row">
      <button type="button" class="bp-link" onclick={() => (step = local ? 'consent' : 'connect')}
        >{t('setup.back')}</button
      >
      <button
        type="button"
        class="bp-btn primary"
        id="bp-setup-scan"
        disabled={hub.scan.busy || hub.scanElsewhere || !hub.ready}
        onclick={scanNow}>{hub.scan.busy ? t('basic.scanning') : t('setup.scan-now')}</button
      >
    </div>
  {/if}
</section>
