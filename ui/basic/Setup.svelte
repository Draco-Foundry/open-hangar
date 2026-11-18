<script>
  // First-run setup (the `firstRun` flag; mockup v4, owner 2026-11-17): the basic page at
  // #setup, opened once on a fresh install (src/background.js). One shell on every step:
  // dots on top, the title, Back and the main button at the bottom. Welcome; Share (what
  // we send and what we never send, the RSI and openhangar.space rows): the pilot answers
  // I Agree (the click that agrees, then Connect) or Decline (Local Mode, nothing sent),
  // with no Skip; Settings, the opt-in switches, each off until the pilot turns it on, the
  // ones that need a connection greyed without one; Scan, which the pilot starts; then
  // Cleared for Launch. Finished, `setupDone` is kept and the page never opens again;
  // closed early, the popup offers Finish Setup. The switches are the popup's
  // (ui/lib/OptInRow.svelte), with the popup's words, and do what its Settings tab does.
  // Every ⓘ is ui/lib/InfoTip.svelte.
  import { onMount } from 'svelte';
  import { t } from './copy.js';
  import { t as pt } from '../popup/copy.js';
  import { flag } from '../lib/flags.js';
  import OptInRow from '../lib/OptInRow.svelte';
  import InfoTip from '../lib/InfoTip.svelte';
  import { connect, hub, scanClick, setupAgree } from './hub.svelte.js';

  const OH = globalThis.OH;
  const FIREFOX = !!chrome.runtime.getManifest().browser_specific_settings?.gecko;
  const NOTIFY = { permissions: ['notifications'] };
  const DAILY = flag('autoScanRun') && flag('autoScan');
  const ALERTS = flag('alerts');
  const LOGS = flag('accountLogs');
  const ORDERS = flag('orderHistory');
  const RSI_SIGN_IN = 'https://robertsspaceindustries.com/connect';
  const STEPS = ['welcome', 'share', 'settings', 'scan'];

  let step = $state('welcome');
  let started = $state(false); // Scan pressed
  let daily = $state(false);
  let notify = $state(false);
  let logs = $state(false);
  let orders = $state(false);
  let tip = $state(''); // the ⓘ held open

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

  // Setup is done: it never opens again.
  async function finish() {
    await chrome.storage.local.set({ setupDone: { at: Date.now() } });
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

  // Share's I Agree: the click that agrees (and Firefox's ask), then Connect.
  async function agree() {
    await setupAgree();
    connect();
    step = 'settings';
  }
  // Decline: Local Mode, nothing is sent.
  function decline() {
    step = 'settings';
  }
  function scanNow() {
    started = true;
    scanClick();
  }
  async function openHangar() {
    await finish();
    if (hangarUrl) location.assign(hangarUrl);
    else location.hash = '';
  }
  const chips = (key) => t(key).split('|');
  const showTip = (id) => (tip = tip === id ? '' : id);
</script>

<section class="bp-card bp-setup" id="bp-setup" aria-labelledby="bp-setup-h">
  {#if !scanned}
    <ol class="bp-steps" aria-hidden="true">
      {#each STEPS as s, i (s)}
        <li class:on={STEPS.indexOf(step) >= i}></li>
      {/each}
    </ol>
  {/if}

  {#if step === 'welcome'}
    <div class="bp-hero">
      <img class="bp-mark" src="../icons/icon128.png" alt="" width="64" height="64" />
      <h2 id="bp-setup-h">{t('setup.welcome')}</h2>
      <p>{t('setup.about')}</p>
    </div>
    <button
      type="button"
      class="bp-btn primary bp-big"
      id="bp-setup-next"
      onclick={() => (step = 'share')}>{t('setup.next')}</button
    >
  {:else if step === 'share'}
    <div class="bp-title">
      <h2 id="bp-setup-h">{t('setup.share')}</h2>
      {#if FIREFOX}<InfoTip
          id="bp-setup-fx-tip"
          label={t('setup.share')}
          text={t('consent.why-firefox')}
          open={tip === 'fx'}
          ontoggle={() => showTip('fx')}
        />{/if}
    </div>
    <div class="bp-share" id="bp-setup-share">
      <div>
        <span class="bp-lab">{t('setup.sends-h')}</span>
        <ul class="bp-chips">
          {#each chips('setup.sends') as c (c)}<li>{c}</li>{/each}
        </ul>
      </div>
      <div>
        <span class="bp-lab">{t('setup.never-h')}</span>
        <ul class="bp-chips no">
          {#each chips('setup.never') as c (c)}<li>{c}</li>{/each}
        </ul>
      </div>
    </div>
    <ul class="bp-checks">
      <li>
        <span class="bp-dot" class:on={signedIn}></span>RSI
        {#if signedIn}<span class="bp-pill ok">{pt('popup.account-live')}</span>
        {:else}<a class="bp-btn" id="bp-setup-rsi" href={RSI_SIGN_IN} target="_blank" rel="noopener"
            >{pt('popup.log-in')}</a
          >{/if}
      </li>
      <li>
        <span class="bp-dot" class:on={linked}></span>openhangar.space
        <span class="bp-pill" class:ok={linked}
          >{linked
            ? t('basic.connected', { name: hub.site.link.name })
            : t('setup.not-connected')}</span
        >
      </li>
    </ul>
    <div class="bp-foot">
      <button type="button" class="bp-btn ghost" onclick={() => (step = 'welcome')}
        >{t('setup.back')}</button
      >
      {#if linked}
        <button
          type="button"
          class="bp-btn primary grow"
          id="bp-setup-to-settings"
          onclick={() => (step = 'settings')}>{t('setup.next')}</button
        >
      {:else}
        <span class="bp-btn grow bp-decline">
          <button type="button" id="bp-setup-decline" onclick={decline}
            >{t('setup.decline')}</button
          >
          <InfoTip
            id="bp-setup-no-tip"
            label={t('setup.decline')}
            text={t('consent.if-no')}
            note={t('consent.change')}
            open={tip === 'no'}
            ontoggle={() => showTip('no')}
          />
        </span>
        <button type="button" class="bp-btn primary grow" id="bp-setup-agree" onclick={agree}
          >{t('setup.agree')}</button
        >
      {/if}
    </div>
  {:else if step === 'settings'}
    <h2 id="bp-setup-h">{t('setup.settings')}</h2>
    <div class="bp-opts" role="group" aria-labelledby="bp-setup-h">
      {#if DAILY}
        <OptInRow
          id="bp-daily"
          label={pt('popup.auto-scan')}
          on={daily}
          disabled={!linked}
          onclick={dailySwitch}
          tip={t('setup.tip-auto')}
          note={linked ? '' : t('setup.needs-link')}
          tipOpen={tip === 'daily'}
          ontip={() => showTip('daily')}
        />
      {/if}
      {#if ALERTS}
        <OptInRow
          id="bp-nt"
          label={pt('popup.notifications')}
          on={notify}
          disabled={!linked}
          onclick={notifySwitch}
          tip={t('setup.tip-notify')}
          note={linked ? '' : t('setup.needs-link')}
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
          note={pt('popup.account-logs-first-scan')}
          tipOpen={tip === 'logs'}
          ontip={() => showTip('logs')}
        />
      {/if}
      {#if ORDERS}
        <OptInRow
          id="bp-orders"
          label={pt('popup.order-history')}
          on={orders}
          onclick={ordersSwitch}
          tip={t('setup.tip-orders')}
          note={pt('popup.order-history-first-scan')}
          tipOpen={tip === 'orders'}
          ontip={() => showTip('orders')}
        />
      {/if}
    </div>
    <div class="bp-foot">
      <button type="button" class="bp-btn ghost" onclick={() => (step = 'share')}
        >{t('setup.back')}</button
      >
      <button
        type="button"
        class="bp-btn primary grow"
        id="bp-setup-to-scan"
        onclick={() => (step = 'scan')}>{t('setup.next')}</button
      >
    </div>
  {:else if scanned}
    <div class="bp-hero">
      <span class="bp-mark done" aria-hidden="true"></span>
      <h2 id="bp-setup-h">{t('setup.done')}</h2>
    </div>
    <button type="button" class="bp-btn primary bp-big" id="bp-setup-hangar" onclick={openHangar}
      >{hangarUrl ? pt('popup.open-my-hangar') : t('setup.next')}</button
    >
  {:else}
    <h2 id="bp-setup-h">{t('setup.scan')}</h2>
    {#if hub.scan.busy && hub.scan.detail}<p class="bp-scan-on">{hub.scan.detail}</p>{/if}
    <div class="bp-foot">
      <button type="button" class="bp-btn ghost" onclick={() => (step = 'settings')}
        >{t('setup.back')}</button
      >
      <button
        type="button"
        class="bp-btn primary grow"
        id="bp-setup-scan"
        disabled={hub.scan.busy || hub.scanElsewhere || !hub.ready}
        onclick={scanNow}>{hub.scan.busy ? t('basic.scanning') : t('setup.scan-now')}</button
      >
    </div>
  {/if}
</section>
