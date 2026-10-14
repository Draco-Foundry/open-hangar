<script>
  // The Hangar tab (owner, 2026-10-14): who this is (the RSI portrait the scan saved,
  // and the handle), Account Value and its change since an earlier scan, Store Credit,
  // buy-back tokens, Fleet News (what in the store is news for this hangar, from the
  // store alerts) and Scan. Before the first scan: one heading and Scan. Signed out of
  // RSI: Log In to RSI, with Scan greyed until the browser holds an RSI session again.
  // While a scan runs: its steps instead of Scan.
  import { t } from './copy.js';
  import { scanSteps, storeCredit, took, unpricedLine } from './data.js';
  import { openTab, reportProblem, rsiSignIn } from './actions.js';

  let {
    v,
    value,
    since,
    avatar,
    account,
    sc,
    signedOut,
    rsiOut,
    report, // the report shown once (Scanned in 38s)
    lastReport, // the last scan's report, for a problem
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
  // Dollars: cents for Store Credit, none for a change or a big total.
  const money = (n, cents = false, most = n >= 1000 ? 0 : 2) =>
    n == null
      ? ''
      : n.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: cents ? 2 : most,
          minimumFractionDigits: cents ? 2 : Math.min(2, most),
        });
  const day = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const credit = $derived(storeCredit(account));
  const nextToken = $derived(OH.nextBuybackToken ? OH.nextBuybackToken(Date.now()) : null);
  const running = $derived(sc.phase === 'running');
  const steps = $derived(scanSteps(sc.progress?.part));
  const STEP = { hangar: 'popup.step-hangar', buybacks: 'popup.step-buybacks', referrals: 'popup.step-referrals' };
  // A problem in the last scan, unless a scan since went fine.
  const trouble = $derived(
    lastReport?.bad && !lastReport.signedOut && !(v?.scannedAt > lastReport.at + 60e3)
      ? (Array.isArray(lastReport.rows) ? lastReport.rows : []).filter((r) => !r?.ok)
      : [],
  );
  const doneIn = $derived(report && !report.bad && !report.signedOut ? took(report.ms) : null);
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
          <span class="pp-since" class:up={since.delta > 0} id="pp-since"
            >{t(since.delta > 0 ? 'popup.up-since' : 'popup.down-since', {
              amount: money(Math.abs(since.delta), false, 0),
              date: day(since.at),
            })}</span
          >
        {/if}
      </div>
      <div class="pp-big" id="pp-value">{money(value ? value.total : v.melt)}</div>
      {#if (value ? value.unpriced : v.unpriced) > 0}
        <div class="pp-unpriced">{unpricedLine(value ? value.unpriced : v.unpriced)}</div>
      {/if}
    </div>

    {#if credit != null || v.tokens != null}
      <div class="pp-tiles">
        {#if credit != null}
          <div class="pp-tile" id="pp-credit">
            <span class="pp-lbl">Store Credit</span><b>{money(credit, true)}</b>
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
        {#each trouble as r (r.id)}<small>{t(STEP[r.id] || 'popup.step-hangar')}: {r.error || r.partial || ''}</small>{/each}
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

    {#if news.length}
      <section class="pp-news" id="pp-news" aria-labelledby="pp-news-h">
        <div class="pp-newstop">
          <h2 class="pp-h3" id="pp-news-h">{t('popup.fleet-news')}</h2>
          <button type="button" class="pp-link" id="pp-all-alerts" onclick={onbell}>{t('popup.all-alerts')}</button>
        </div>
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
  {:else if signedOut}
    <button type="button" class="pp-btn primary big" id="pp-login" onclick={() => openTab(rsiSignIn())}
      >{t('popup.log-in')}</button
    >
    <button type="button" class="pp-btn" id="pp-scan" disabled={rsiOut} onclick={onscan}
      >{t('popup.scan')}</button
    >
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
  {#if note}<p class="pp-note" role="status">{note}</p>{/if}
{/snippet}
