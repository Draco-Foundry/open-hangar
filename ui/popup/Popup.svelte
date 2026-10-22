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
    autoAsk,
    fleetNews,
    newReport,
    popupView,
    portrait,
    progressFraction,
    reportPilot,
    reportSyncFailed,
    syncTrouble,
    scanAge,
    scanState,
    storeCredit,
    valueSince,
  } from './data.js';
  import { applyLook, cleanPrefs, loadPrefs, savePref } from './prefs.js';
  import { pilotAnswer, rsiAccess } from './actions.js';
  import { fxFor, loadRates, shownCurrency } from './currency.js';
  import { rsiCookie, rsiSignIn, watchCookie } from './rsi-cookie.js';
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
  // The last scan that began (local scanStarted), and Auto Scan Daily's switch and last
  // run (local autoScanOn, autoScan): a start that never ended shows Scan stopped, even
  // after a browser restart (#676).
  let started = $state(null);
  let auto = $state({ on: false, rec: null });
  let shown = $state(null); // the report shown once (Scanned in 38s)
  let link = $state(null); // the openhangar.space link, when sync is on
  let pilotDone = $state(false); // the scan's sync question, answered here
  let justUpdated = $state(null);
  // At the top of every tab, as on the basic page: a new version waiting to be let in
  // (local updateReady, src/background.js) and the kill switch's banner (status.json's,
  // OH.getRemoteStatus: the copy main.js refreshes, so nothing more is asked).
  let updateReady = $state(null);
  let banner = $state(null);
  let prefs = $state(cleanPrefs());
  let session = $state({});
  let rsiOff = $state(false); // no access to robertsspaceindustries.com
  // RSI's sign-in cookie: 'in', 'out' or null (can't tell) (./rsi-cookie.js: whether
  // it's there, never its value).
  let cookie = $state(null);
  let rates = $state(null); // the day's exchange rates, only for a currency other than USD
  let now = $state(Date.now());
  let asked = $state(0); // when this popup asked for a scan the background runs unseen
  let note = $state('');
  // The scanBar flag: Scan asked and the background said another scan is running (when),
  // said in the bar's spot, with Scan greyed, for a minute.
  const BAR = flag('scanBar');
  let busyAt = $state(0);
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
    const s = scanState(
      { ...session, scanReport: report, scanStarted: started, autoScan: auto.rec },
      now,
    );
    // Asked from here a moment ago, and nothing written yet: running all the same.
    if (s.phase !== 'running' && asked && now - asked < 60e3 && !(report?.at > asked))
      return { phase: 'running', hidden: true, progress: null, run: null };
    return s;
  });
  const busy = $derived(sc.phase === 'running');
  const frac = $derived(sc.progress ? Math.round(progressFraction(sc.progress) * 100) : null);
  const age = $derived(scanAge(v?.scannedAt, now));
  const news = $derived(ALERTS && alerts.on ? fleetNews(alerts.items, fresh) : []);
  // Signed out of RSI: RSI's sign-in cookie isn't in this browser, or the last account
  // read or scan said so and the browser can't say about the cookie. Log In to RSI first,
  // with a grey Scan still there to press (./rsi-cookie.js).
  const readOut = $derived.by(() => {
    if (report?.signedOut && !report.rsiDown && !newer(report) && Number.isFinite(report.at)) return report.at;
    if (v?.signedOut) return Number.isFinite(account?.fetchedAt) ? account.fetchedAt : 0;
    return null;
  });
  const signIn = $derived(rsiSignIn({ cookie, readOut, justOut: shown?.signedOut === true && !shown.rsiDown }));
  const signedOut = $derived(signIn !== 'in');
  // Amounts in the currency picked (US dollars until one is), from US dollars.
  const currency = $derived(shownCurrency(prefs.currency));
  const fx = $derived(fxFor(currency, rates));
  const failing = $derived(
    failed || reportSyncFailed(report, v?.connected ? { lastSync: v.connected.lastSync } : null),
  );
  // A sync that didn't go through: the amber dot on Settings. So does an Auto Scan Daily
  // run that kept a part back (until a scan saves since), while it's on.
  const trouble = $derived(syncTrouble({ connected: v?.connected, failed: failing }, now));
  const autoAsks = $derived(
    flag('autoScan') &&
      !!v?.connected &&
      autoAsk({ on: auto.on, rec: auto.rec, scannedAt: v?.scannedAt }),
  );
  // The scan's sync asked first (an RSI account new to this connection): the question
  // on Hangar, until it's answered here or anywhere else, or a sync since went through.
  const pilot = $derived.by(() => {
    if (pilotDone || !link || !v?.connected) return null;
    const who = reportPilot(report, { account, db });
    if (!who) return null;
    const answer = OH.sitePilotAnswer ? OH.sitePilotAnswer(link, who) : 'new';
    if (answer === 'yes' || answer === 'no') return null;
    const last = v.connected.lastSync;
    return Number.isFinite(last) && last >= report.sync.at ? null : who;
  });
  const hasNews = $derived(justUpdated?.to === version && prefs.seenVersion !== version);

  // A report older than the last scan's own time is a stale one.
  function newer(r) {
    return v?.scannedAt != null && Number.isFinite(r?.at) && v.scannedAt > r.at + 60e3;
  }

  async function loadData() {
    const [stored, got, siteLink, siteUrl] = await Promise.all([
      OH.loadDB(),
      chrome.storage.local.get([
        'account',
        'avatarImg',
        'scanReport',
        'justUpdated',
        'updateReady',
        'scanStarted',
        'autoScan',
        'autoScanOn',
      ]),
      OH.siteEnabled().then((on) => (on ? OH.getSiteLink() : null)),
      OH.siteUrl(),
    ]);
    const hangarPage = globalThis.OHPages?.pages?.hangar?.[0] || '';
    db = stored;
    account = got.account || null;
    justUpdated = got.justUpdated || null;
    updateReady = got.updateReady || null;
    started = got.scanStarted || null;
    auto = { on: got.autoScanOn === true, rec: got.autoScan || null };
    link = siteLink || null;
    v = popupView(
      { db: stored, account: got.account, link: siteLink, siteUrl, hangarPage },
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
  // Whether RSI's sign-in cookie is here.
  async function readCookie() {
    cookie = await rsiCookie(chrome.cookies, { access: !rsiOff });
  }
  function setReport(r) {
    report = r;
    const n = newReport(r, prefs.reportSeenAt);
    if (n) {
      shown = n;
      pilotDone = false;
      prefs.reportSeenAt = n.at;
      savePref({ reportSeenAt: n.at });
    }
  }
  // Sync It or Not This One, for the scan's question. Sync It syncs now (Settings shows
  // how that went, as after Sync Now).
  async function answerPilot(yes) {
    const who = pilot;
    pilotDone = true;
    if (!who) return;
    const r = await pilotAnswer(who, yes).catch((e) => ({ msg: String(e?.message || e) }));
    if (r?.msg) {
      note = r.msg;
      failed = r.calm ? null : { msg: r.msg };
    }
  }
  async function loadAlerts() {
    if (!ALERTS) return;
    const got = await chrome.storage.local.get([AL.ON_KEY, AL.STATE_KEY, 'siteLink', 'siteUrl']);
    const on = got[AL.ON_KEY] === true;
    const state = got[AL.STATE_KEY];
    alerts = {
      on,
      // Not the ones deleted here (#701, the bell's × and Clear All).
      items: on ? AL.shown(state) : [],
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
  const readBanner = () =>
    OH.getRemoteStatus()
      .then((st) => (banner = st?.banner || null))
      .catch(() => {});
  // Reload to Update, as the basic page's: the browser lets the new version in (the
  // popup closes with it). Not while a scan runs: the background lets it in after.
  const reloadForUpdate = () => chrome.runtime.reload();
  const readAccess = async () => (rsiOff = !(await rsiAccess()));
  const accessChanged = async () => {
    await readAccess();
    await readCookie();
  };
  // The rates, once this popup's settings are read: none for USD.
  $effect(() => {
    if (!ready) return;
    const code = currency;
    loadRates(code).then((r) => {
      if (code === currency) rates = r;
    });
  });

  onMount(() => {
    (async () => {
      prefs = await loadPrefs();
      applyLook(prefs.look);
      await Promise.all([loadData(), loadSession(), loadAlerts(), readAccess(), readBanner()]);
      await readCookie();
      ready = true;
    })();
    // A sign-in or sign-out in another tab while the popup is open.
    const unwatch = watchCookie(readCookie, chrome.cookies);
    const changed = (c, area) => {
      if (area === 'local') {
        if (c.db || c.account || c.siteLink || c.siteUrl || c.avatarImg) loadData();
        else if (c.scanReport) setReport(c.scanReport.newValue || null);
        if (c.scanStarted) started = c.scanStarted.newValue || null;
        if (c.autoScan || c.autoScanOn)
          auto = {
            on: c.autoScanOn ? c.autoScanOn.newValue === true : auto.on,
            rec: c.autoScan ? c.autoScan.newValue || null : auto.rec,
          };
        if (c.justUpdated) justUpdated = c.justUpdated.newValue || null;
        if (c.updateReady) updateReady = c.updateReady.newValue || null;
        if (c.remoteStatus) readBanner();
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
    // Access to RSI given or taken back (the basic page's Allow Access to RSI, Firefox's
    // add-ons page).
    chrome.permissions?.onAdded?.addListener(accessChanged);
    chrome.permissions?.onRemoved?.addListener(accessChanged);
    const clock = setInterval(() => (now = Date.now()), 15e3);
    return () => {
      chrome.storage.onChanged.removeListener(changed);
      chrome.permissions?.onAdded?.removeListener(accessChanged);
      chrome.permissions?.onRemoved?.removeListener(accessChanged);
      unwatch();
      clearInterval(clock);
    };
  });

  async function scan() {
    note = '';
    // The bar takes Scan's place at once (scanBar), so it can't be pressed twice.
    if (BAR) asked = now = Date.now();
    const r = await chrome.runtime.sendMessage({ ohPopup: 'scan' }).catch(() => null);
    if (!r?.ok) {
      if (BAR) asked = 0;
      if (r?.error === 'busy' && BAR) return void (busyAt = now = Date.now());
      if (r?.error === 'busy') return void (note = t('popup.scan-busy'));
      // Any other no (or no answer): the background brought the Open Hangar page up
      // instead (src/background.js), so the popup closes, as before.
      return void window.close();
    }
    const s = chrome.storage.session
      ? await chrome.storage.session.get(['scanProgress', 'scanRunning'])
      : {};
    // A background that opened a tab to scan in (it's in front now): as before.
    if (r.opened && !s.scanProgress && !s.scanRunning?.run) return void window.close();
    asked = now = Date.now();
    shown = null;
  }

  // Not saved: every popup opens on Hangar (the owner, 2026-10-19).
  function pickTab(id) {
    tab = id;
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
    <Alerts {alerts} {fresh} {fx} />
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
    {#if busy && !BAR}
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

    {#if updateReady}
      <div class="pp-notice" id="pp-update" role="status">
        <span>{t('popup.update-ready', { version: updateReady })}</span>
        <button type="button" class="pp-link" id="pp-update-reload" disabled={busy} onclick={reloadForUpdate}
          >{t('popup.update-reload')}</button
        >
      </div>
    {/if}
    {#if banner}
      <div class="pp-notice" class:warn={banner.level === 'warn'} id="pp-banner" role="status">
        {banner.message}
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
          {rsiOff}
          {fx}
          report={shown}
          lastReport={report}
          {note}
          busyNote={BAR && !!busyAt && now - busyAt < 60e3}
          {now}
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
              class:dot={id === 'settings' && (!!trouble || autoAsks)}
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
              {rsiOff}
              {fx}
              report={shown}
              lastReport={report}
              {pilot}
              onpilot={answerPilot}
              {note}
          busyNote={BAR && !!busyAt && now - busyAt < 60e3}
          {now}
              {news}
              onscan={scan}
              onbell={openBell}
              {alerts}
              {fresh}
            />
          {:else if tab === 'wishlist'}
            <Wishlist connected={!!v.connected} {fx} />
          {:else}
            <Settings
              {v}
              {busy}
              {failing}
              {prefs}
              {currency}
              lastReport={report}
              onlook={setLook}
              oncurrency={setCurrency}
              onfailed={(f) => (failed = f)}
              onnote={(n) => (note = n)}
            />
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
</main>
