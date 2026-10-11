<script>
  // The basic page (the connector build, src/basic.html): the one extension page left
  // when the website is the full app. Scan, Pledges and Buy-Backs with search, totals
  // and CSV, Report a Scan Problem, and the settings. It stays as it is ("frozen"):
  // new views go to the website. Tabs are the address's hash (#pledges, #buybacks,
  // #settings), so the popup and the background can open one.
  import { onMount } from 'svelte';
  import { t } from './copy.js';
  import {
    firefoxContinue,
    hub,
    pilotAnswer,
    reloadForUpdate,
    reportProblem,
    rsiAllow,
    scanClick,
    start,
  } from './hub.svelte.js';
  import List from './List.svelte';
  import Settings from './Settings.svelte';
  import FirefoxCard from './FirefoxCard.svelte';

  const TABS = ['pledges', 'buybacks', 'settings'];
  const fromHash = () => {
    const h = location.hash.slice(1);
    return TABS.includes(h) ? h : 'pledges';
  };
  let tab = $state(fromHash());
  onMount(() => {
    start();
    const hash = () => (tab = fromHash());
    addEventListener('hashchange', hash);
    return () => removeEventListener('hashchange', hash);
  });
  const go = (name) => {
    tab = name;
    history.replaceState(null, '', `#${name}`);
  };
  const handle = $derived(
    (hub.account?.loggedIn && (hub.account.displayname || hub.account.nickname)) ||
      hub.owner?.displayname ||
      hub.owner?.nickname ||
      '',
  );
  const report = $derived(hub.scan.report);
</script>

<div class="bp">
  <header class="bp-top">
    <img src="../icons/icon32.png" alt="" width="24" height="24" />
    <h1>Open Hangar</h1>
    {#if handle}<span class="bp-who">{handle}</span>{/if}
    <button
      type="button"
      class="bp-btn primary bp-scan"
      id="bp-scan"
      onclick={scanClick}
      disabled={hub.scan.busy || !hub.ready}
      >{hub.scan.busy ? t('basic.scanning') : t('basic.scan')}</button
    >
  </header>
  {#if hub.scan.busy}<p class="bp-detail" role="status">{hub.scan.detail}</p>{/if}

  {#if hub.update}
    <div class="bp-note" id="bp-update" role="status">
      {t('basic.update-ready', { version: hub.update })}
      <button type="button" class="bp-btn" onclick={reloadForUpdate}>{t('basic.update-reload')}</button>
    </div>
  {/if}
  {#if hub.banner}
    <div class="bp-note" class:warn={hub.banner.level === 'warn'} role="status">
      {hub.banner.message}
    </div>
  {/if}
  {#if hub.note}<div class="bp-note" role="status">{hub.note}</div>{/if}

  {#if hub.ready && !hub.rsiOk}
    <div class="bp-note warn" id="bp-rsi-access" role="alert">
      <p>{t('basic.rsi-access-why')}</p>
      <button type="button" class="bp-btn primary" id="bp-rsi-allow" onclick={() => rsiAllow()}
        >Allow Access to RSI</button
      >
    </div>
  {/if}

  {#if report && (report.bad || report.signedOut)}
    <div class="bp-note warn" id="bp-report" role="alert">
      <b>{report.signedOut ? t('basic.signed-out') : t('basic.scan-problem')}</b>
      {#if report.rows.length}
        <ul>
          {#each report.rows as r (r.name)}
            <li class:bad={!r.ok}>{r.name}: {r.text}</li>
          {/each}
        </ul>
      {/if}
      {#if !report.signedOut}
        <button type="button" class="bp-btn" id="bp-report-btn" onclick={reportProblem}
          >Report a Scan Problem</button
        >
      {/if}
    </div>
  {:else if report}
    <p class="bp-done" id="bp-done" role="status">
      {t('basic.scan-done')}
      {report.rows.map((r) => r.text).join(' · ')}
    </p>
  {/if}

  {#if hub.site.askFirefox}
    <FirefoxCard
      local={hub.site.askFirefox === 'local'}
      onContinue={firefoxContinue}
      onClose={() => (hub.site.askFirefox = null)}
    />
  {/if}
  {#if hub.site.pilot}
    <div class="bp-note" id="bp-pilot" role="dialog" aria-labelledby="bp-pilot-h">
      <b id="bp-pilot-h">{t('basic.pilot-title', { handle: hub.site.pilot.handle })}</b>
      <p>{t('basic.pilot-body')}</p>
      <div class="bp-row">
        <button type="button" class="bp-btn primary" onclick={() => pilotAnswer(true)}
          >{t('basic.pilot-yes')}</button
        >
        <button type="button" class="bp-btn" onclick={() => pilotAnswer(false)}
          >{t('basic.pilot-no')}</button
        >
      </div>
    </div>
  {/if}

  <nav class="bp-tabs" aria-label={t('basic.tabs')}>
    <a href="#pledges" aria-current={tab === 'pledges' ? 'page' : undefined} onclick={(e) => (e.preventDefault(), go('pledges'))}
      >{t('basic.tab-pledges')} <small>{hub.items.length}</small></a
    >
    <a href="#buybacks" aria-current={tab === 'buybacks' ? 'page' : undefined} onclick={(e) => (e.preventDefault(), go('buybacks'))}
      >Buy-Backs <small>{hub.buybacks.length}</small></a
    >
    <a href="#settings" aria-current={tab === 'settings' ? 'page' : undefined} onclick={(e) => (e.preventDefault(), go('settings'))}
      >{t('basic.tab-settings')}</a
    >
  </nav>

  {#if !hub.ready}
    <p class="bp-empty">{t('basic.loading')}</p>
  {:else if tab === 'settings'}
    <Settings />
  {:else}
    {#key tab}<List kind={tab} />{/key}
  {/if}
</div>
