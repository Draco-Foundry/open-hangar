<script>
  // Connect (the browser's sign-in window: Approve there and it closes by itself; or,
  // as a fallback, the code shown big to match the website tab). Once connected the
  // corner goes quiet: sync lives in the top bar's Scan button (SyncStatus,
  // SyncMenu; owner, 2026-10-05). On Firefox a line under Connect says what we share,
  // and Learn More (or Connect, until Firefox has said yes) opens FirefoxExplain.
  // Hidden until the website is switched on (OH.siteEnabled).
  import { app, version } from '../lib/app.svelte.js';
  import FirefoxExplain from './FirefoxExplain.svelte';

  const d = $derived.by(() => {
    version.n;
    const s = app().site.state;
    return {
      enabled: s.enabled,
      link: s.link,
      waiting: s.waiting ? s.waiting.code || '' : '',
      // The browser's sign-in window is open (the usual way to connect).
      inWindow: !!(s.waiting && s.waiting.window),
      firefox: s.firefox,
      dataOk: s.dataOk,
      msg: s.msg,
    };
  });
  // While the Firefox card is up: the button that opened it (focus goes back there).
  let explain = $state(null);

  const site = () => app().site;
  function explainFrom(e) {
    explain = e.currentTarget;
  }
  function connect(e) {
    if (d.firefox && !d.dataOk) explainFrom(e);
    else site().connect();
  }
</script>

{#if d.enabled && !d.link}
  <div class="site-connect" id="site-connect" aria-live="polite">
    {#if d.inWindow}
      <span class="sc-chip wait"><span class="sc-spin" aria-hidden="true"></span>Docking…</span>
      <p class="sc-hint">
        Finish connecting in the window that opened: sign in if asked, then press Approve.
      </p>
    {:else if d.waiting}
      <span class="sc-hint">Approve this code on openhangar.space</span>
      <span class="sc-code">{d.waiting}</span>
      <div class="sc-row">
        <button type="button" class="sc-btn quiet" onclick={() => site().reopen()}
          >Open the Page Again ↗</button
        >
        <button type="button" class="sc-btn" onclick={() => site().cancel()}>Cancel</button>
      </div>
      <p class="sc-hint">Spooling the quantum drive… this card updates by itself.</p>
    {:else}
      <button type="button" class="sc-btn primary" onclick={connect}
        ><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"
          ><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4" /><path
            d="M1.8 8h12.4M8 1.7c2 2.2 2 10.4 0 12.6M8 1.7c-2 2.2-2 10.4 0 12.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          /></svg
        >Connect to openhangar.space</button
      >
      <p class="sc-hint">
        Optional. See your hangar on any device. Nothing is sent until you connect.
      </p>
      {#if d.firefox}
        <p class="sc-ff">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            /></svg
          ><span
            >We'll share your <b>pledge prices and store credit</b> with openhangar.space, so
            Firefox asks you first.
            <button
              type="button"
              class="sc-learn"
              onclick={explainFrom}>Learn More</button
            ></span
          >
        </p>
      {/if}
    {/if}
    {#if d.msg}<p class="sc-msg" role="status">{d.msg}</p>{/if}
  </div>
  {#if explain}
    <FirefoxExplain opener={explain} onClose={() => (explain = null)} />
  {/if}
{/if}
