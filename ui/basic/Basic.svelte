<script>
  // The basic page (the connector build, src/basic.html). Since 0.4.0 the toolbar popup
  // holds the hangar and the settings, and scans run in a hidden page
  // (src/scan-host.js), so this page only opens when the extension needs a page that
  // stays open: Firefox's asks (its data card, Allow Access to RSI), Connect (#settings:
  // the sign-in window would close the popup), and a scan that can't run hidden, with
  // its progress and report. No lists here: the hangar itself is on openhangar.space.
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
  import SiteCard from './SiteCard.svelte';
  import FirefoxCard from './FirefoxCard.svelte';

  // Opened for openhangar.space (the popup's Connect, the background's asks).
  const forSite = () => location.hash === '#settings';
  let site = $state(forSite());
  onMount(() => {
    start();
    const hash = () => (site = forSite());
    addEventListener('hashchange', hash);
    return () => removeEventListener('hashchange', hash);
  });
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
      disabled={hub.scan.busy || hub.scanElsewhere || !hub.ready}
      >{hub.scan.busy ? t('basic.scanning') : t('basic.scan')}</button
    >
  </header>
  {#if hub.scan.busy}<p class="bp-detail" role="status">{hub.scan.detail}</p>
  {:else if hub.scanElsewhere}<p class="bp-detail" id="bp-scan-elsewhere" role="status">
      {t('basic.scan-elsewhere')}
    </p>{/if}

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
      {#if report.signedOut}<p id="bp-signed-out">{t('basic.signed-out-line')}</p>{/if}
      {#if report.down}<p id="bp-rsi-down">{report.down}</p>{/if}
      {#if report.rows.length}
        <ul>
          {#each report.rows as r (r.name)}
            <!-- A row's own words for this box, where its name comes first. -->
            <li class:bad={!r.ok}>{r.name}: {r.box ?? r.text}</li>
          {/each}
        </ul>
      {/if}
      {#if !report.signedOut && !report.down}
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

  {#if !hub.ready}
    <p class="bp-empty">{t('basic.loading')}</p>
  {:else if site && hub.site.enabled}
    <SiteCard />
  {:else if !site}
    <p class="bp-about" id="bp-about">{t('basic.page-about')}</p>
  {/if}
</div>
