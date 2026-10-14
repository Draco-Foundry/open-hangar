<script>
  // The toolbar popup (the connector build, src/flags.js `connector`), as the owner
  // signed it off (2026-10-14): a header (the version, the scan's age, the alerts
  // bell), three tabs (Hangar, Wishlist, Settings) and the bell's Alerts view. It shows
  // what's stored in this browser and never asks RSI anything (ui/popup/data.js). Scan
  // asks the background (src/background.js), and the popup stays open with the scan's
  // progress and result from the shared keys (session scanRunning and scanProgress,
  // local scanReport); a background that runs the scan in a tab brings that tab to the
  // front instead, as before.
  import { onMount, tick } from 'svelte';
  import { t } from './copy.js';
  import {
    TABS,
    fleetNews,
    newReport,
    openingTab,
    popupView,
    portrait,
    progressFraction,
    reportSyncFailed,
    syncTrouble,
    scanAge,
    scanState,
    storeCredit,
    valueSince,
  } from './data.js';
  import { applyLook, cleanPrefs, loadPrefs, savePref } from './prefs.js';
  import { rsiCookie } from './actions.js';
  import { flag } from '../lib/flags.js';
  import Alerts from './Alerts.svelte';
  import Hangar from './Hangar.svelte';
  import Wishlist from './Wishlist.svelte';
  import Settings from './Settings.svelte';

  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  const ALERTS = flag('alerts') && !!AL;
  const version = chrome.runtime.getManifest().version || '';

  let ready = $state(false);
  let v = $state(null);
  let value = $state(null); // OH.accountValue once ship prices are in
  let since = $state(null); // { delta, at }: Account Value since an earlier scan
  let avatar = $state(null);
  let db = $state(null);
  let account = $state(null);
  let report = $state(null); // the last scan's report (local scanReport)
  let shown = $state(null); // the report shown once (Scanned in 38s)
  let again = $state(null); // siteSyncAgain: a sync the website's pace held back
  let justUpdated = $state(null);
  let prefs = $state(cleanPrefs());
  let session = $state({});
  let rsi = $state(null); // the RSI session cookie: '' none, null can't tell
  let now = $state(Date.now());
  let asked = $state(0); // when this popup asked for a scan the background runs unseen
  let note = $state('');
  let failed = $state(null); // the popup's own Sync Now that didn't go through
  // The store alerts (the `alerts` flag): on, the matches, which were unseen when the
  // popup opened (the bell's number, the toolbar badge's), connected, where our Store is.
  let alerts = $state({ on: null, items: [], connected: false, feeds: '' });
  let fresh = $state(new Set());
  let bellCount = $state(0);
  let tab = $state('hangar');
  let bell = $state(false);
  let whatsNew = $state(false);
  let first = true;
  let bellBtn = $state();
  let backBtn = $state();

  const sc = $derived.by(() => {
    const s = scanState({ ...session, scanReport: report }, now);
    // Asked from here a moment ago, and nothing written yet: running all the same.
    if (s.phase === 'idle' && asked && now - asked < 60e3 && !(report?.at > asked))
      return { phase: 'running', hidden: true, progress: null, run: null };
    return s;
  });
  const busy = $derived(sc.phase === 'running');
  const frac = $derived(sc.progress ? Math.round(progressFraction(sc.progress) * 100) : null);
  const age = $derived(scanAge(v?.scannedAt, now));
  const news = $derived(ALERTS && alerts.on ? fleetNews(alerts.items, fresh) : []);
  // Signed out of RSI: the last account read or scan said so, or the browser holds no
  // RSI session at all. Scan greys out only for the last (it lights up once there's one).
  const signedOut = $derived(
    rsi === '' || !!v?.signedOut || (!!report?.signedOut && !newer(report)),
  );
  const failing = $derived(
    failed || reportSyncFailed(report, v?.connected ? { lastSync: v.connected.lastSync } : null),
  );
  // A sync that didn't go through: the amber dot on Settings.
  const trouble = $derived(syncTrouble({ connected: v?.connected, again, failed: failing }, now));
  const hasNews = $derived(justUpdated?.to === version && prefs.seenVersion !== version);

  // A report older than the last scan's own time is a stale one.
  function newer(r) {
    return v?.scannedAt != null && Number.isFinite(r?.at) && v.scannedAt > r.at + 60e3;
  }

  async function loadData() {
    const [stored, got, link, siteUrl] = await Promise.all([
      OH.loadDB(),
      chrome.storage.local.get(['account', 'avatarImg', 'scanReport', 'justUpdated', 'siteSyncAgain']),
      OH.siteEnabled().then((on) => (on ? OH.getSiteLink() : null)),
      OH.siteUrl(),
    ]);
    const hangarPage = globalThis.OHPages?.pages?.hangar?.[0] || '';
    db = stored;
    account = got.account || null;
    justUpdated = got.justUpdated || null;
    again = got.siteSyncAgain || null;
    v = popupView(
      { db: stored, account: got.account, link, siteUrl, hangarPage },
      { totalValue: (items) => OH.totalValue(items), syncWait: OH.siteSyncWait },
    );
    avatar = portrait(got.avatarImg, v.nickname);
    setReport(got.scanReport || null);
    if (v.items.length) {
      const { priceOf } = await OH.getShipIndex();
      const acct = OH.accountValue(v.items, priceOf, storeCredit(got.account));
      value = acct;
      // Scans from before Store Credit was recorded count today's credit, so the change
      // is the hangar's own.
      const valueOf = (s) =>
        OH.snapshotValue(s, acct, priceOf) + (Number.isFinite(s.credit) ? 0 : acct.credit);
      since = valueSince(stored.history, acct.total, valueOf, v.scannedAt);
    } else {
      value = null;
      since = null;
    }
  }
  async function loadSession() {
    session = chrome.storage.session
      ? await chrome.storage.session.get(['scanRunning', 'scanRequest', 'scanProgress'])
      : {};
  }
  function setReport(r) {
    report = r;
    const n = newReport(r, prefs.reportSeenAt);
    if (n) {
      shown = n;
      prefs.reportSeenAt = n.at;
      savePref({ reportSeenAt: n.at });
    }
  }
  async function loadAlerts() {
    if (!ALERTS) return;
    const got = await chrome.storage.local.get([AL.ON_KEY, AL.STATE_KEY, 'siteLink', 'siteUrl']);
    const on = got[AL.ON_KEY] === true;
    const state = got[AL.STATE_KEY];
    alerts = {
      on,
      items: on && Array.isArray(state?.items) ? state.items : [],
      connected: !!got.siteLink?.token,
      feeds: AL.sitesOf(got.siteUrl).feeds,
    };
    // The ones new since you last looked stay marked while the popup is open; opening it
    // marks them seen (the background clears the toolbar badge).
    if (first) {
      first = false;
      fresh = new Set(on ? AL.unseen(state).map((m) => m.id) : []);
      bellCount = fresh.size;
      if (fresh.size) chrome.runtime.sendMessage({ ohPopup: 'alerts-seen' }).catch(() => {});
    }
  }
  const readRsi = async () => (rsi = await rsiCookie());

  onMount(() => {
    (async () => {
      prefs = await loadPrefs();
      applyLook(prefs.look);
      await Promise.all([loadData(), loadSession(), loadAlerts(), readRsi()]);
      const unseenNews = news.filter((m) => fresh.has(m.id)).length;
      tab = v?.scannedAt == null ? 'hangar' : openingTab(prefs.tab, unseenNews);
      ready = true;
    })();
    const changed = (c, area) => {
      if (area === 'local') {
        if (c.db || c.account || c.siteLink || c.siteUrl || c.avatarImg || c.siteSyncAgain)
          loadData();
        else if (c.scanReport) setReport(c.scanReport.newValue || null);
        if (c.justUpdated) justUpdated = c.justUpdated.newValue || null;
        if (ALERTS && (c[AL.ON_KEY] || c[AL.STATE_KEY] || c.siteLink)) loadAlerts();
      }
      if (area === 'session') {
        const next = { ...session };
        for (const k of ['scanRunning', 'scanRequest', 'scanProgress'])
          if (c[k]) next[k] = c[k].newValue;
        session = next;
      }
    };
    chrome.storage.onChanged.addListener(changed);
    const cookie = (info) => {
      if (/robertsspaceindustries\.com$/.test(info?.cookie?.domain || '')) readRsi();
    };
    chrome.cookies?.onChanged?.addListener(cookie);
    const clock = setInterval(() => (now = Date.now()), 15e3);
    return () => {
      chrome.storage.onChanged.removeListener(changed);
      chrome.cookies?.onChanged?.removeListener(cookie);
      clearInterval(clock);
    };
  });

  async function scan() {
    note = '';
    if (rsi === '') return;
    const r = await chrome.runtime.sendMessage({ ohPopup: 'scan' }).catch(() => null);
    if (r && !r.ok && r.error === 'busy') return void (note = t('popup.scan-busy'));
    if (!r) return void window.close();
    const s = chrome.storage.session
      ? await chrome.storage.session.get(['scanProgress', 'scanRunning'])
      : {};
    // A background that opened a tab to scan in (it's in front now): as before.
    if (r.opened && !s.scanProgress && !s.scanRunning?.run) return void window.close();
    asked = now = Date.now();
    shown = null;
  }

  function pickTab(id) {
    tab = id;
    savePref({ tab: id });
  }
  // The tab row's keys: arrows move along (and wrap), Home and End jump.
  async function tabKey(e) {
    const i = TABS.indexOf(tab);
    const to =
      e.key === 'ArrowRight'
        ? (i + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (i + TABS.length - 1) % TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    pickTab(TABS[to]);
    await tick();
    document.getElementById(`pp-tab-${TABS[to]}`)?.focus();
  }
  async function openBell() {
    bell = true;
    await tick();
    backBtn?.focus();
  }
  async function closeBell() {
    bell = false;
    bellCount = 0;
    await tick();
    bellBtn?.focus();
  }
  function gotIt() {
    whatsNew = false;
    prefs.seenVersion = version;
    savePref({ seenVersion: version });
  }
  function setLook(look) {
    prefs.look = look;
    applyLook(look);
    savePref({ look });
  }
  function setCurrency(currency) {
    prefs.currency = currency;
    savePref({ currency });
  }

  const ageLine = $derived(
    sc.phase === 'running'
      ? t('popup.scanning-short')
      : sc.phase === 'stopped'
        ? t('popup.stopped')
        : age.tone === 'never'
          ? t('popup.never')
          : t(`popup.ago-${age.unit}`, { n: age.n }),
  );
  const ageTone = $derived(
    sc.phase === 'running' ? 'run' : sc.phase === 'stopped' ? 'stale' : age.tone,
  );
  const firstRun = $derived(v && v.scannedAt == null);
  const LABEL = { hangar: 'popup.tab-hangar', wishlist: 'popup.tab-wishlist', settings: 'popup.tab-settings' };
</script>

<main class="pp" class:first={firstRun}>
  {#if bell}
    <header class="pp-hd">
      <button
        type="button"
        class="pp-back"
        id="pp-back"
        bind:this={backBtn}
        aria-label={t('popup.back')}
        onclick={closeBell}>‹</button
      >
      <h1 class="pp-name">{t('popup.bell')}</h1>
      <span class="pp-bell on" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10 21a2 2 0 0 0 4 0"></path></svg
        >
      </span>
    </header>
    <Alerts {alerts} {fresh} />
  {:else}
    <header class="pp-hd">
      <svg class="pp-logo" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
        ><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"></path></svg
      >
      <h1 class="pp-name">Open Hangar</h1>
      {#if hasNews}
        <button
          type="button"
          class="pp-ver news"
          id="pp-ver"
          aria-expanded={whatsNew}
          onclick={() => (whatsNew = !whatsNew)}
          >v{version}<i aria-hidden="true"></i><span class="pp-sr">{t('popup.new-in', { version })}</span></button
        >
      {:else}
        <span class="pp-ver" id="pp-ver">v{version}</span>
      {/if}
      <span class="pp-age {ageTone}" id="pp-age" aria-live="polite"><i aria-hidden="true"></i>{ageLine}</span>
      {#if ALERTS && !firstRun}
        <button
          type="button"
          class="pp-bell"
          id="pp-bell"
          bind:this={bellBtn}
          aria-label={bellCount ? t('popup.alerts', { n: bellCount }) : t('popup.bell')}
          onclick={openBell}
          ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
            ><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10 21a2 2 0 0 0 4 0"></path></svg
          >{#if bellCount}<span class="pp-n" aria-hidden="true">{bellCount > 9 ? '9+' : bellCount}</span>{/if}</button
        >
      {/if}
    </header>
    {#if busy}
      <div class="pp-bar" role="progressbar" aria-label={t('popup.scanning-short')} aria-valuemin="0" aria-valuemax="100"
        aria-valuenow={frac ?? undefined}>
        <i style:width={frac == null ? null : `${frac}%`} class:wait={frac == null}></i>
      </div>
    {/if}
    {#if whatsNew && hasNews}
      <div class="pp-whatsnew" id="pp-whatsnew">
        <b>{t('popup.new-in', { version })}</b>
        <span class="pp-row">
          <button
            type="button"
            class="pp-link"
            onclick={() => {
              chrome.tabs.create({ url: 'https://github.com/Draco-Foundry/open-hangar/blob/main/CHANGELOG.md' });
              window.close();
            }}>{t('popup.what-changed')}</button
          >
          <button type="button" class="pp-link quiet" id="pp-got-it" onclick={gotIt}>{t('popup.got-it')}</button>
        </span>
      </div>
    {/if}

    {#if ready && v}
      {#if firstRun}
        <Hangar
          {v}
          {value}
          {since}
          {avatar}
          {db}
          {account}
          {sc}
          {signedOut}
          rsiOut={rsi === ''}
          report={shown}
          lastReport={report}
          {note}
          news={[]}
          first
          onscan={scan}
          onbell={openBell}
          {alerts}
          {fresh}
        />
      {:else}
        <div class="pp-tabs" role="tablist" aria-label={t('popup.tabs')} tabindex="-1" onkeydown={tabKey}>
          {#each TABS as id (id)}
            <button
              type="button"
              role="tab"
              id="pp-tab-{id}"
              aria-selected={tab === id}
              aria-controls="pp-panel-{id}"
              tabindex={tab === id ? 0 : -1}
              class:dot={id === 'settings' && !!trouble}
              onclick={() => pickTab(id)}
            >
              <svg class="pp-ti" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                {#if id === 'hangar'}<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"></path>
                {:else if id === 'wishlist'}<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path>
                {:else}<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>{/if}
              </svg>
              <span>{t(LABEL[id])}</span>
            </button>
          {/each}
        </div>
        <div class="pp-panel" role="tabpanel" id="pp-panel-{tab}" aria-labelledby="pp-tab-{tab}">
          {#if tab === 'hangar'}
            <Hangar
              {v}
              {value}
              {since}
              {avatar}
              {db}
              {account}
              {sc}
              {signedOut}
              rsiOut={rsi === ''}
              report={shown}
              lastReport={report}
              {note}
              {news}
              onscan={scan}
              onbell={openBell}
              {alerts}
              {fresh}
            />
          {:else if tab === 'wishlist'}
            <Wishlist connected={!!v.connected} />
          {:else}
            <Settings
              {v}
              {busy}
              {again}
              {failing}
              {prefs}
              lastReport={report}
              onlook={setLook}
              oncurrency={setCurrency}
              onfailed={(f) => (failed = f)}
            />
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
</main>
