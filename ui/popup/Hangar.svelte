<script>
  // The Hangar tab (owner, 2026-10-14): who this is (the RSI portrait the scan saved,
  // and the handle), Account Value and its change since an earlier scan, Store Credit,
  // buy-back tokens, Fleet News (what in the store is news for this hangar, from the
  // store alerts) and Scan. Before the first scan: one heading and Scan. Signed out of
  // RSI: Log In to RSI, with a grey Scan under it, always there to press (./rsi-cookie.js:
  // the cookie can't say for sure; the scan does). No access to RSI (Firefox's add-ons page): Allow Access to RSI, on
  // the basic page. While a scan runs: its steps instead of Scan. After one: how long it
  // took, or what went wrong, and the question when its sync found an RSI account new to
  // the connection. Amounts in the currency picked (`fx`, ./currency.js), the dollar
  // figure on hover.
  import { t } from './copy.js';
  import {
    reportDone,
    reportPaused,
    reportTrouble,
    scanSteps,
    storeCredit,
    unpricedLine,
  } from './data.js';
  import { openHub, openTab, reportProblem, rsiSignIn } from './actions.js';
  import { USD, money } from './currency.js';

  let {
    v,
    value,
    since,
    avatar,
    account,
    sc,
    signedOut,
    fx = USD,
    rsiOff = false, // no access to robertsspaceindustries.com
    report, // the report shown once (Scanned in 38s)
    lastReport, // the last scan's report, for a problem
    pilot = null, // the scan's sync asked: { handle } (ask), answered with onpilot(yes)
    onpilot,
    note,
    news,
    first = false,
    onscan,
    onbell,
    alerts,
    fresh,
  } = $props();

  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  // Cents for Store Credit, none for a change or a big total.
  const total = $derived(money(value ? value.total : v.melt, fx));
  const change = $derived(since ? money(Math.abs(since.delta), fx, { most: 0 }) : null);
  const day = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const credit = $derived(storeCredit(account));
  const creditText = $derived(credit != null ? money(credit, fx, { cents: true }) : null);
  const nextToken = $derived(OH.nextBuybackToken ? OH.nextBuybackToken(Date.now()) : null);
  const running = $derived(sc.phase === 'running');
  const steps = $derived(scanSteps(sc.progress?.part));
  const STEP = { hangar: 'popup.step-hangar', buybacks: 'popup.step-buybacks', referrals: 'popup.step-referrals' };
  // A problem in the last scan (a part not read, or read only in part), unless a scan
  // since went fine.
  const trouble = $derived(reportTrouble(lastReport, v?.scannedAt));
  const ROW = { hangar: 'popup.row-pledges', buybacks: 'popup.row-buybacks' };
  const rowText = (r) =>
    !r.ok
      ? r.error || ''
      : r.id === 'referrals'
        ? t('popup.row-referrals')
        : ROW[r.id] && Number.isFinite(r.n)
          ? t(ROW[r.id], { n: r.n })
          : '';
  // Only a scan that read everything says how long it took (never a held one).
  const doneIn = $derived(reportDone(report));
  const paused = $derived(reportPaused(lastReport, v?.scannedAt));
  const noRsi = $derived(rsiOff || report?.held === 'no-rsi');
  const switched = $derived(report?.switched?.who ? report.switched : null);
  const sub = (m) => (AL ? AL.lines(m)[0] || '' : '');
</script>

{#if first}
  <div class="pp-body pp-first" id="pp-first">
    <svg class="pp-big-ic" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"
      ><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"></path><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"></path></svg
    >
    {#if !signedOut}<h2 class="pp-h">{t('popup.first')}</h2>{/if}
    {@render action()}
  </div>
{:else}
  <div class="pp-body">
    <div class="pp-who">
      <span class="pp-face">
        {#if avatar}<img src={avatar} alt="" width="34" height="34" />{:else}<svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg
          >{/if}
      </span>
      <span class="pp-whoname">
        <b id="pp-handle">{v.nickname || v.handle}</b>
        {#if v.name && v.name !== (v.nickname || v.handle)}<small>{v.name}</small>{/if}
      </span>
      {#if v.myHangar}
        <button type="button" class="pp-link pp-mine" id="pp-hangar" onclick={() => openTab(v.myHangar)}
          >Open My Hangar ↗</button
        >
      {/if}
    </div>

    <div class="pp-value" aria-live="polite">
      <div class="pp-vtop">
        <span class="pp-lbl">{value ? 'Account Value' : t('popup.melt-label')}</span>
        {#if since && value}
          <span class="pp-since" class:up={since.delta > 0} id="pp-since" title={change.title || null}
            >{t(since.delta > 0 ? 'popup.up-since' : 'popup.down-since', {
              amount: change.text,
              date: day(since.at),
            })}</span
          >
        {/if}
      </div>
      <div class="pp-big" id="pp-value" title={total.title || null}>{total.text}</div>
      {#if (value ? value.unpriced : v.unpriced) > 0}
        <div class="pp-unpriced">{unpricedLine(value ? value.unpriced : v.unpriced)}</div>
      {/if}
    </div>

    {#if credit != null || v.tokens != null}
      <div class="pp-tiles">
        {#if credit != null}
          <div class="pp-tile" id="pp-credit">
            <span class="pp-lbl">Store Credit</span><b title={creditText.title || null}>{creditText.text}</b>
          </div>
        {/if}
        {#if v.tokens != null}
          <div class="pp-tile" id="pp-tokens">
            <span class="pp-lbl">Buy-Back Tokens</span>
            <span class="pp-tok"
              ><b>{v.tokens}</b>{#if nextToken}<small>{t('popup.token-next', { date: day(nextToken) })}</small>{/if}</span
            >
          </div>
        {/if}
      </div>
    {/if}

    {#if trouble.length}
      <div class="pp-trouble" id="pp-trouble" role="alert">
        <b>{t('popup.scan-problem')}</b>
        {#each trouble as r (r.id)}<small>{t(STEP[r.id] || 'popup.step-hangar')}: {rowText(r)}</small>{/each}
        <button type="button" class="pp-link" id="pp-report" onclick={() => reportProblem(lastReport)}
          >Report a Scan Problem</button
        >
      </div>
    {/if}
    {#if switched}
      <p class="pp-note" role="status">
        {t(switched.restored ? 'popup.switched-back' : 'popup.switched-new', { who: switched.who })}
      </p>
    {/if}
    {#if pilot}
      <div class="pp-trouble pp-pilot" id="pp-pilot" role="group" aria-labelledby="pp-pilot-h">
        <b id="pp-pilot-h">{t('popup.pilot-title', { handle: pilot.handle })}</b>
        <small>{t('popup.pilot-body')}</small>
        <div class="pp-pair">
          <button type="button" class="pp-btn2" id="pp-pilot-yes" onclick={() => onpilot(true)}
            >{t('popup.pilot-yes')}</button
          >
          <button type="button" class="pp-btn2" id="pp-pilot-no" onclick={() => onpilot(false)}
            >{t('popup.pilot-no')}</button
          >
        </div>
      </div>
    {/if}

    {#if news.length || alerts?.on}
      <section class="pp-news" id="pp-news" aria-labelledby="pp-news-h">
        <div class="pp-newstop">
          <h2 class="pp-h3" id="pp-news-h">{t('popup.fleet-news')}</h2>
          {#if alerts?.items?.length}
            <button type="button" class="pp-link" id="pp-all-alerts" onclick={onbell}>{t('popup.all-alerts')}</button>
          {/if}
        </div>
        {#if !news.length}<p class="pp-note" id="pp-news-none">{t('popup.fleet-news-none')}</p>{/if}
        {#each news as m (m.id)}
          {@const wish = m.why.some((w) => w.why === 'wishlist')}
          <button
            type="button"
            class="pp-item"
            class:wish
            onclick={() => openTab(AL.itemUrl(alerts.feeds, m))}
          >
            <span class="pp-ic" aria-hidden="true">
              {#if wish}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                  ><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg
                >{:else}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                  ><path d="M20 12l-8 8-9-9V3h8z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle></svg
                >{/if}
            </span>
            <span class="pp-itext">
              {#if fresh.has(m.id)}<span class="pp-sr">{t('popup.alerts-unseen')}</span>{/if}
              <span class="pp-iname">{m.name}</span>
              <small>{sub(m)}</small>
            </span>
            <span class="pp-chev" aria-hidden="true">›</span>
          </button>
        {/each}
      </section>
    {/if}

    {@render action()}
  </div>
{/if}

{#snippet action()}
  {#if running}
    <div class="pp-steps" id="pp-steps" aria-live="polite">
      {#if sc.progress}
        {#each steps as s (s.id)}
          <div class="pp-step {s.state}">
            <span aria-hidden="true">{s.state === 'done' ? '✓' : s.state === 'now' ? '●' : '○'}</span>{t(STEP[s.id])}
          </div>
        {/each}
      {:else if !sc.hidden}
        <p class="pp-note">{t('popup.scanning')}</p>
      {/if}
    </div>
  {:else if noRsi}
    <!-- The basic page's card asks the browser (its ask would close the popup). -->
    <button type="button" class="pp-btn primary" id="pp-rsi-allow" onclick={() => openHub()}
      >Allow Access to RSI</button
    >
  {:else if signedOut}
    <button type="button" class="pp-btn primary big" id="pp-login" onclick={() => openTab(rsiSignIn())}
      >{t('popup.log-in')}</button
    >
    <button type="button" class="pp-btn grey" id="pp-scan" onclick={onscan}>{t('popup.scan')}</button>
  {:else}
    <button type="button" class="pp-btn primary" id="pp-scan" onclick={onscan}
      >{sc.phase === 'stopped' ? t('popup.scan-again') : t('popup.scan')}</button
    >
  {/if}
  {#if doneIn && !running}
    <p class="pp-done" id="pp-done" role="status">
      <span aria-hidden="true">✓</span>{doneIn.m
        ? t('popup.scanned-in-m', { m: doneIn.m, s: doneIn.s })
        : t('popup.scanned-in-s', { s: doneIn.s })}
    </p>
  {/if}
  {#if paused && !running}<p class="pp-note" id="pp-paused" role="status">{paused}</p>{/if}
  {#if note}<p class="pp-note" role="status">{note}</p>
  {:else if report?.held === 'busy' && !running}<p class="pp-note" role="status">{t('popup.scan-busy')}</p>{/if}
{/snippet}
