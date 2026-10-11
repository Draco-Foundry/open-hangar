<script>
  // The toolbar popup (the connector build, src/flags.js `connector`): Account Value,
  // the last scan, Scan, Open My Hangar, the store alerts (the `alerts` flag,
  // ./Alerts.svelte) and where sync stands. It shows what's stored here and never asks RSI anything
  // (ui/popup/data.js). Scan asks the background, which brings the
  // extension's page to the front to run it (src/background.js requestScan).
  import { onMount } from 'svelte';
  import { t } from './copy.js';
  import { HUB_PAGE, popupView, scanBusy, storeCredit } from './data.js';
  import { at, synced } from '../site/when.js';
  import { flag } from '../lib/flags.js';
  import Alerts from './Alerts.svelte';

  const OH = globalThis.OH;
  let v = $state(null);
  let value = $state(null); // { total } once ship prices are in
  let busy = $state(false);
  let note = $state('');

  const money = (n) =>
    n == null
      ? ''
      : n.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: n >= 1000 ? 0 : 2,
        });

  async function load() {
    const [db, { account }, link, siteUrl] = await Promise.all([
      OH.loadDB(),
      chrome.storage.local.get('account'),
      OH.siteEnabled().then((on) => (on ? OH.getSiteLink() : null)),
      OH.siteUrl(),
    ]);
    const hangarPage = globalThis.OHPages?.pages?.hangar?.[0] || '';
    v = popupView(
      { db, account, link, siteUrl, hangarPage },
      { totalValue: (items) => OH.totalValue(items), syncWait: OH.siteSyncWait },
    );
    const s = chrome.storage.session
      ? await chrome.storage.session.get(['scanRunning', 'scanRequest'])
      : {};
    busy = scanBusy(s);
    if (v.items.length) {
      const { priceOf } = await OH.getShipIndex();
      value = OH.accountValue(v.items, priceOf, storeCredit(account));
    } else value = null;
  }

  onMount(() => {
    load();
    const changed = (c, area) => {
      if (area === 'local' && (c.db || c.account || c.siteLink || c.siteUrl)) load();
      if (area === 'session' && (c.scanRunning || c.scanRequest)) load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  });

  async function scan() {
    note = '';
    const r = await chrome.runtime.sendMessage({ ohPopup: 'scan' }).catch(() => null);
    if (r && !r.ok && r.error === 'busy') note = t('popup.scan-busy');
    else window.close();
  }
  function openHub(hash = '') {
    chrome.tabs.create({ url: chrome.runtime.getURL(HUB_PAGE) + hash });
    window.close();
  }
  function openHangar() {
    chrome.tabs.create({ url: v.myHangar });
    window.close();
  }
  const when = (at) => synced(at)?.long || '';
</script>

<main class="pp">
  <header class="pp-top">
    <img src="../icons/icon32.png" alt="" width="20" height="20" />
    <b>Open Hangar</b>
    {#if v?.handle}<span class="pp-who">{v.handle}</span>{/if}
  </header>

  {#if v}
    <section class="pp-value" aria-live="polite">
      <div class="pp-lbl">{value ? 'Account Value' : t('popup.melt-label')}</div>
      <div class="pp-big" id="pp-value">{money(value ? value.total : v.melt)}</div>
    </section>

    <p class="pp-scan" class:warn={v.staleDays != null} id="pp-last">
      {#if busy}{t('popup.scanning')}
      {:else if v.scannedAt == null}{t('popup.no-scan')}
      {:else if v.staleDays != null}{t('popup.stale', { days: v.staleDays })}
      {:else}{t('popup.last-scan', { when: when(v.scannedAt) })}{/if}
    </p>
    {#if v.signedOut}<p class="pp-note">{t('popup.signed-out')}</p>{/if}

    <div class="pp-acts">
      <button type="button" class="pp-btn primary" id="pp-scan" onclick={scan} disabled={busy}
        >{t('popup.scan')}</button
      >
      {#if v.myHangar}
        <button type="button" class="pp-btn" id="pp-hangar" onclick={openHangar}
          >Open My Hangar ↗</button
        >
      {/if}
    </div>
    {#if note}<p class="pp-note" role="status">{note}</p>{/if}

    {#if flag('alerts')}<Alerts {openHub} />{/if}

    <section class="pp-site" id="pp-site">
      {#if v.connected}
        <i class="pp-dot on" aria-hidden="true"></i>
        <span
          >{t('popup.connected', { name: v.connected.name })}<small
            >{v.connected.waitUntil
              ? t('popup.sync-wait', { time: at(v.connected.waitUntil) })
              : v.connected.lastSync
                ? t('popup.synced', { when: when(v.connected.lastSync) })
                : t('popup.not-synced')}</small
          ></span
        >
      {:else}
        <i class="pp-dot" aria-hidden="true"></i>
        <span
          >{t('popup.not-connected')}<button
            type="button"
            class="pp-link"
            id="pp-connect"
            onclick={() => openHub('#settings')}>Connect to openhangar.space</button
          ></span
        >
      {/if}
    </section>

    <button type="button" class="pp-link pp-page" id="pp-page" onclick={() => openHub()}
      >{t('popup.open-page')}</button
    >
  {/if}
</main>
