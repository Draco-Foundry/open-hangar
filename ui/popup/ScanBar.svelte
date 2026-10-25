<script>
  // Scan's place at the top of the popup, under the header, on every tab (the owner,
  // 2026-10-26); on the first run, under its heading. One row, one height in every state.
  // The Scan button is the bar (the scanBar flag): pressed, the same shape fills with the
  // part running and what it has read (./data.js barLabel, barFraction). After a full scan:
  // how long it took, for 4 seconds (longer while the pointer or focus is on it), then Scan
  // again. RSI's wait, a scan already running elsewhere, RSI not answering or a page RSI
  // changed: the line in the row, with a small Scan beside it (greyed for the first two).
  // Signed out of RSI: Log In to RSI, with a grey Scan beside it, always there to press
  // (./rsi-cookie.js: the cookie can't say for sure; the scan does). No access to RSI
  // (Firefox's add-ons page): Allow Access to RSI, on the basic page. Without the flag: the
  // scan's steps instead of Scan while it runs.
  import { t } from './copy.js';
  import {
    barFraction,
    barNext,
    barLabel,
    reportDone,
    reportPageChanged,
    reportPaused,
    reportRsi,
    scanHold,
    scanSteps,
  } from './data.js';
  import { openHub, openTab, rsiSignIn } from './actions.js';
  import { flag } from '../lib/flags.js';

  let {
    v,
    sc,
    signedOut,
    rsiOff = false, // no access to robertsspaceindustries.com
    report, // the report shown once (Scanned in 38s)
    lastReport, // the last scan's report
    note,
    busyNote = false, // Scan asked a moment ago and another scan was running (scanBar)
    now = Date.now(),
    onscan,
  } = $props();

  const running = $derived(sc.phase === 'running');
  const steps = $derived(scanSteps(sc.progress?.part));
  const STEP = { hangar: 'popup.step-hangar', buybacks: 'popup.step-buybacks', referrals: 'popup.step-referrals' };
  const BAR = flag('scanBar');
  const pageChanged = $derived(!running && reportPageChanged(lastReport, v?.scannedAt));
  // Only a scan that read everything says how long it took (never a held one).
  const doneIn = $derived(reportDone(report));
  const paused = $derived(reportPaused(lastReport, v?.scannedAt));
  // RSI didn't answer the last scan: a 5xx, or its ask to wait (./data.js reportRsi).
  const rsi = $derived(running ? null : reportRsi(lastReport, v?.scannedAt, now));
  const noRsi = $derived(rsiOff || report?.held === 'no-rsi');

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
    new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/ /g, ' ');

  // The done line holds the row for 4 seconds, then gives way to Scan; never while the
  // pointer or focus is on it (the owner, 2026-10-26).
  const DONE_MS = 4000;
  let rowEl = $state();
  let doneOver = $state(null); // the report whose done line has had its time
  $effect(() => {
    const r = report;
    if (!BAR || !doneIn || doneOver === r) return;
    let timer;
    const tick = () => {
      if (rowEl?.matches(':hover') || rowEl?.contains(document.activeElement)) timer = setTimeout(tick, 500);
      else doneOver = r;
    };
    timer = setTimeout(tick, DONE_MS);
    return () => clearTimeout(timer);
  });

  // What the row says: → { text, n, tone: 'run' | 'done' | 'note' } or null for Scan alone.
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
    if (doneIn && doneOver !== report)
      return {
        text: doneIn.m ? t('popup.scanned-in-m', { m: doneIn.m, s: doneIn.s }) : t('popup.scanned-in-s', { s: doneIn.s }),
        n: '',
        tone: 'done',
      };
    return null;
  });
  // Scan greyed: RSI's wait, or another scan running a moment ago (the owner, 2026-10-20).
  // Never the grey Scan beside Log In to RSI: signed out, the scan is what tells.
  const scanOff = $derived(BAR && (!!hold || busyNote));
  const scanLabel = $derived(sc.phase === 'stopped' ? t('popup.scan-again') : t('popup.scan'));
</script>

{#snippet icon()}
  <svg class="pp-scan-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    ><path d="M20 12a8 8 0 1 1-2.34-5.66"></path><path d="M20 4v4h-4"></path></svg
  >
{/snippet}

<div class="pp-act" id="pp-act" bind:this={rowEl}>
  {#if bar && bar.tone !== 'note'}
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
      <i class:wait={bar.tone === 'run' && fill == null} bind:this={fillEl}></i>
      <span class="pp-sbar-t"
        >{#if bar.tone === 'done'}<b aria-hidden="true">✓</b>{/if}<span>{bar.text}</span>{#if bar.n}<span
            class="pp-sbar-n">{bar.n}</span
          >{/if}</span
      >
    </div>
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
    <button type="button" class="pp-btn primary solid" id="pp-rsi-allow" onclick={() => openHub()}
      >{t('popup.allow-rsi')}</button
    >
  {:else if signedOut}
    <div class="pp-pair2">
      <button type="button" class="pp-btn primary solid" id="pp-login" onclick={() => openTab(rsiSignIn())}
        >{t('popup.log-in')}</button
      >
      <button type="button" class="pp-btn grey sm" id="pp-scan" onclick={onscan}>{@render icon()}{t('popup.scan')}</button>
    </div>
  {:else if bar?.tone === 'note'}
    <div class="pp-sbar note" id="pp-sbar">
      <span class="pp-sbar-t" role="status"><span>{bar.text}</span></span>
      <button type="button" class="pp-btn primary sm" id="pp-scan" disabled={scanOff} onclick={onscan}
        >{@render icon()}{scanLabel}</button
      >
    </div>
  {:else}
    <button type="button" class="pp-btn primary" id="pp-scan" disabled={scanOff} onclick={onscan}
      >{@render icon()}{scanLabel}</button
    >
  {/if}
  {#if running && BAR && !sc.progress && !sc.hidden}<p class="pp-note">{t('popup.scanning')}</p>{/if}
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
</div>
