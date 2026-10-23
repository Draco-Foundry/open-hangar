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
  // With the scanBar flag (owner, 2026-10-20): one bar where Scan sits instead of the
  // steps, naming the part running and counting what it has read (./data.js barLabel,
  // barFraction). In the same spot after: how long the scan took, a scan already running
  // elsewhere, or RSI's wait (Scan greyed under it until then).
  import { t } from './copy.js';
  import {
    barFraction,
    barNext,
    barLabel,
    reportDone,
    reportPageChanged,
    reportPaused,
    reportRsi,
    reportTrouble,
    scanHold,
    scanSteps,
    storeCredit,
    gameCredit,
    tokenCount,
    unpricedLine,
  } from './data.js';
  import { openHub, openTab, reportProblem, rsiSignIn } from './actions.js';
  import { FIT, USD, moneyFit } from './currency.js';
  import { flag } from '../lib/flags.js';

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
    busyNote = false, // Scan asked a moment ago and another scan was running (scanBar)
    now = Date.now(),
    news,
    first = false,
    onscan,
    onwishlist,
    alerts,
    fresh,
  } = $props();

  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  // Cents for Store Credit, none for a change or a big total.
  const total = $derived(moneyFit(value ? value.total : v.melt, fx));
  const change = $derived(since ? moneyFit(Math.abs(since.delta), fx, { most: 0, full: FIT.change }) : null);
  const day = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const credit = $derived(storeCredit(account));
  const creditText = $derived(credit != null ? moneyFit(credit, fx, { cents: true, full: FIT.credit }) : null);
  const uec = $derived(gameCredit(account, 'uec'));
  const rec = $derived(gameCredit(account, 'rec'));
  const tokens = $derived(tokenCount(v.tokens));
  const nextToken = $derived(OH.nextBuybackToken ? OH.nextBuybackToken(Date.now()) : null);
  const running = $derived(sc.phase === 'running');
  const steps = $derived(scanSteps(sc.progress?.part));
  const STEP = { hangar: 'popup.step-hangar', buybacks: 'popup.step-buybacks', referrals: 'popup.step-referrals' };
  const BAR = flag('scanBar');
  // A problem in the last scan (a part not read, or read only in part), unless a scan
  // since went fine. With the scan bar, a page RSI changed is the bar's line instead.
  const trouble = $derived(
    reportTrouble(lastReport, v?.scannedAt).filter((r) => !(BAR && r.pageChanged)),
  );
  const pageChanged = $derived(!running && reportPageChanged(lastReport, v?.scannedAt));
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
  // RSI didn't answer the last scan: a 5xx, or its ask to wait (./data.js reportRsi).
  const rsi = $derived(running ? null : reportRsi(lastReport, v?.scannedAt, now));
  const noRsi = $derived(rsiOff || report?.held === 'no-rsi');
  const switched = $derived(report?.switched?.who ? report.switched : null);
  const sub = (m) => (AL ? AL.lines(m)[0] || '' : '');

  // The fill only moves forward within a run (RSI's pager can show more pages as the
  // scan goes). Not state: it's what the bar has shown.
  let peak = { run: null, f: 0 };
  const fill = $derived.by(() => {
    if (!running || !sc.progress) return null;
    const run = sc.run || sc.progress.run || null;
    if (peak.run !== run) peak = { run, f: 0 };
    peak.f = Math.max(peak.f, barFraction(sc.progress));
    return peak.f;
  });
  // Between the scan's writes the fill creeps on towards where the next page puts it
  // (./data.js barNext), over about as long as a page has been taking, and stops just
  // short of it: the bar keeps moving and never runs ahead of the scan.
  const next = $derived(fill == null ? null : Math.max(fill, barNext(sc.progress)));
  const runId = $derived(sc.run || sc.progress?.run || null);
  let fillEl = $state();
  let pace = { run: null, at: 0, gap: 1500 };
  const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  $effect(() => {
    const el = fillEl;
    if (!el) return;
    if (fill == null) {
      el.style.transition = '';
      el.style.width = '';
      return;
    }
    const t = performance.now();
    const run = runId;
    if (pace.run !== run) pace = { run, at: t, gap: 1500 };
    else if (t - pace.at > 200) pace.gap = Math.min(8000, Math.max(600, (pace.gap + (t - pace.at)) / 2));
    pace.at = t;
    el.style.transition = 'width 0.4s ease-out';
    el.style.width = `${fill * 100}%`;
    if (still || next <= fill) return;
    const creep = setTimeout(() => {
      el.style.transition = `width ${pace.gap}ms linear`;
      el.style.width = `${(fill + (next - fill) * 0.9) * 100}%`;
    }, 400);
    return () => clearTimeout(creep);
  });
  const hold = $derived(running ? null : scanHold(lastReport, now));
  const holdTime = (at) =>
    new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/ /g, ' ');
  // What the bar says: → { text, n, tone: 'run' | 'done' | 'note' } or null for no bar.
  const bar = $derived.by(() => {
    if (!BAR) return null;
    if (running) {
      const l = barLabel(sc.progress);
      return { text: t(l.key), n: l.n, tone: 'run' };
    }
    if (hold) return { text: t('popup.rsi-wait', { time: holdTime(hold) }), n: '', tone: 'note' };
    if (rsi?.kind === 'down') return { text: t('popup.rsi-down'), n: '', tone: 'note' };
    if (busyNote || report?.held === 'busy') return { text: t('popup.scan-busy'), n: '', tone: 'note' };
    if (pageChanged) return { text: t('popup.rsi-page-changed'), n: '', tone: 'note' };
    if (doneIn)
      return {
        text: doneIn.m ? t('popup.scanned-in-m', { m: doneIn.m, s: doneIn.s }) : t('popup.scanned-in-s', { s: doneIn.s }),
        n: '',
        tone: 'done',
      };
    return null;
  });
  // Scan greyed: RSI's wait, or another scan running a moment ago (the owner, 2026-10-20).
  // Never the grey Scan under Log In to RSI: signed out, the scan is what tells.
  const scanOff = $derived(BAR && (!!hold || busyNote));
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
          >Open My Hangar</button
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
      <div
        class="pp-big"
        id="pp-value"
        title={total.title || null}
        role={total.short ? 'group' : null}
        aria-label={total.short ? total.title : null}
      >{total.text}</div>
      {#if (value ? value.unpriced : v.unpriced) > 0}
        <div class="pp-unpriced">{unpricedLine(value ? value.unpriced : v.unpriced)}</div>
      {/if}
    </div>

    {#if credit != null || v.tokens != null}
      <div class="pp-tiles">
        {#if credit != null}
          <div
            class="pp-tile"
            id="pp-credit"
            role={creditText.short ? 'group' : null}
            aria-label={creditText.short ? `Store Credit ${creditText.title}` : null}
          >
            <span class="pp-lbl">Store Credit</span><b title={creditText.title || null}>{creditText.text}</b>
          </div>
        {/if}
        {#if tokens}
          <div
            class="pp-tile"
            id="pp-tokens"
            role={tokens.text !== tokens.full ? 'group' : null}
            aria-label={tokens.text !== tokens.full ? `Buy-Back Tokens ${tokens.full}` : null}
          >
            <span class="pp-lbl">Buy-Back Tokens</span>
            <span class="pp-tok"
              ><b title={tokens.text !== tokens.full ? tokens.full : null}>{tokens.text}</b>{#if nextToken}<small>{t('popup.token-next', { date: day(nextToken) })}</small>{/if}</span
            >
          </div>
        {/if}
      </div>
    {/if}
    {#if uec || rec}
      <div class="pp-tiles">
        {#if uec}
          <div class="pp-tile" id="pp-uec" title={uec.full} role="group" aria-label={`UEC ${uec.full}`}>
            <span class="pp-lbl">UEC</span><b>{uec.text}</b>
          </div>
        {/if}
        {#if rec}
          <div class="pp-tile" id="pp-rec" title={rec.full} role="group" aria-label={`REC ${rec.full}`}>
            <span class="pp-lbl">REC</span><b>{rec.text}</b>
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
            <button type="button" class="pp-link" id="pp-news-wishlist" onclick={onwishlist}
              >{t('popup.news-wishlist')}</button
            >
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
            <span class="pp-chev" aria-hidden="true"><svg class="chev" viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 3l5 5-5 5"/></svg></span>
          </button>
        {/each}
      </section>
    {/if}

    {@render action()}
  </div>
{/if}

{#snippet action()}
  {#if bar}
    <div
      class="pp-sbar {bar.tone}"
      id="pp-sbar"
      role={bar.tone === 'run' ? 'progressbar' : 'status'}
      aria-label={bar.tone === 'run' ? t('popup.scanning-short') : null}
      aria-valuemin={bar.tone === 'run' ? 0 : null}
      aria-valuemax={bar.tone === 'run' ? 100 : null}
      aria-valuenow={bar.tone === 'run' && fill != null ? Math.round(fill * 100) : null}
      aria-valuetext={bar.tone === 'run' ? [bar.text, bar.n].filter(Boolean).join(' ') : null}
    >
      <i class:wait={bar.tone === 'run' && fill == null} bind:this={fillEl}
      ></i>
      <span class="pp-sbar-t"><span>{bar.text}</span>{#if bar.n}<span class="pp-sbar-n">{bar.n}</span>{/if}</span>
    </div>
  {/if}
  {#if running && BAR}
    {#if !sc.progress && !sc.hidden}<p class="pp-note">{t('popup.scanning')}</p>{/if}
  {:else if running}
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
      {#if sc.progress?.retry}<p class="pp-note" id="pp-rsi-waiting">{t('popup.rsi-waiting')}</p>{/if}
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
    <button type="button" class="pp-btn primary" id="pp-scan" disabled={scanOff} onclick={onscan}
      >{sc.phase === 'stopped' ? t('popup.scan-again') : t('popup.scan')}</button
    >
  {/if}
  {#if doneIn && !running && !BAR}
    <p class="pp-done" id="pp-done" role="status">
      <span aria-hidden="true">✓</span>{doneIn.m
        ? t('popup.scanned-in-m', { m: doneIn.m, s: doneIn.s })
        : t('popup.scanned-in-s', { s: doneIn.s })}
    </p>
  {/if}
  {#if rsi && !BAR}
    <p class="pp-note" id="pp-rsi" role="status">
      {rsi.kind === 'wait' ? t('popup.rsi-wait', { time: holdTime(rsi.at) }) : t('popup.rsi-down')}
    </p>
  {/if}
  {#if paused && !running}<p class="pp-note" id="pp-paused" role="status">{paused}</p>{/if}
  {#if note}<p class="pp-note" role="status">{note}</p>
  {:else if report?.held === 'busy' && !running && !BAR}<p class="pp-note" role="status">{t('popup.scan-busy')}</p>{/if}
{/snippet}
