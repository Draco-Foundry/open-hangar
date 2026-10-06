<script>
  // Game Status in the top bar (owner, Home Layout B Final): a pill like the
  // website header's, compact since Top Bar Option A: "4.10.1" with a dot in the
  // services' colour (green all systems go, amber disrupted, red down), "LIVE 4.10.1"
  // on hover. Click for LIVE and PTU, the newest patch
  // notes and the event on now (and the next one). From openhangar.space's public
  // feed (ui/lib/game-status.js): asked at most every 10 minutes, the last copy
  // kept; until it has ever loaded the pill just says "Game Status".
  import { loadGameStatus, pillOf } from '../lib/game-status.js';
  import { daysAgo, daysUntil, shortDay } from '../lib/format.js';
  import { menus, register, toggleMenu, menuClick } from './menus.svelte.js';

  let gs = $state(null);
  let loaded = $state(false);
  const refresh = () =>
    loadGameStatus()
      .then((d) => {
        if (d) gs = d;
      })
      .catch(() => {})
      .finally(() => (loaded = true));
  refresh();

  const pill = $derived(pillOf(gs));
  // Compact in the bar (Top Bar Option A, 2026-10-06): the dot and "4.10.1"; the full
  // "LIVE 4.10.1" (and how the services are doing) is the hover text and the label.
  const short = $derived(gs?.live ? gs.live.version : pill.text);
  const full = $derived(
    [`Game Status: ${pill.text === 'Game Status' ? 'not loaded yet' : pill.text}`, gs?.status?.label]
      .filter(Boolean)
      .join('. '),
  );
  const DOT_TITLE = { ok: 'All systems go', degraded: 'Some services disrupted', down: 'Services down' };

  let btn = $state();
  let menu = $state();
  $effect(() => register('gs', btn, menu));

  function open(e) {
    // The Citizen Card's popups close too: one pop-up at a time.
    document.dispatchEvent(new CustomEvent('oh:close-popups'));
    if (menus.open !== 'gs') refresh(); // cached for 10 minutes, so usually no request
    toggleMenu('gs', e);
  }
  const ago = (t) => (t ? daysAgo(t) : '');
</script>

<div class="gs-wrap">
  <button
    bind:this={btn}
    id="gs-pill"
    class="gs-pill"
    class:open={menus.open === 'gs'}
    type="button"
    aria-haspopup="dialog"
    aria-expanded={menus.open === 'gs'}
    aria-controls="gs-menu"
    title={full}
    aria-label={full}
    onclick={open}
  >
    <i class="dot {pill.dot}" aria-hidden="true"></i><span class="gs-txt">{short}</span><svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" /></svg
    >
  </button>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menu}
    id="gs-menu"
    class="scan-menu gs-menu"
    role="dialog"
    tabindex="-1"
    aria-label="Game Status"
    hidden={menus.open !== 'gs'}
    onclick={menuClick}
  >
    <div class="gs-head">
      <h3>Game Status</h3>
      {#if gs?.status}
        {#if gs.status.url}<a class="gs-sys {gs.status.level}" href={gs.status.url} target="_blank" rel="noopener"
            ><i class="dot {gs.status.level}" title={DOT_TITLE[gs.status.level]}></i>{gs.status.label} ↗</a
          >{:else}<span class="gs-sys {gs.status.level}"
            ><i class="dot {gs.status.level}"></i>{gs.status.label}</span
          >{/if}
      {/if}
    </div>
    {#if gs}
      {#if gs.live}
        <div class="gs-row">
          <div class="gs-top"><span><i class="ch live"></i>LIVE</span><b>{gs.live.version}</b></div>
          {#if gs.live.released}<div class="gs-sub">Released {shortDay(gs.live.released)}, {ago(gs.live.released)}</div>{/if}
        </div>
      {/if}
      {#if gs.ptu}
        <div class="gs-row">
          <div class="gs-top"><span><i class="ch test"></i>PTU</span><b>{gs.ptu.version}</b></div>
          <div class="gs-sub">
            {[gs.ptu.wave, gs.ptu.notesAt ? `Notes ${ago(gs.ptu.notesAt)}` : 'In testing'].filter(Boolean).join(', ')}
          </div>
        </div>
      {/if}
      {#if gs.patchNotes}
        <a class="gs-more" href={gs.patchNotes.url} target="_blank" rel="noopener" title={gs.patchNotes.title}
          >Latest Patch Notes ↗</a
        >
      {/if}
      <div class="gs-evs">
        {#if gs.event}
          <div class="gs-kv">
            {#if gs.event.url}<a href={gs.event.url} target="_blank" rel="noopener" class="ev">{gs.event.name} ↗</a
              >{:else}<span class="ev">{gs.event.name}</span>{/if}
            <span class="v">{gs.event.end ? `Ends ${daysUntil(gs.event.end)}` : 'On now'}</span>
          </div>
        {:else}
          <div class="gs-kv"><span class="oh-q">No event running. Enjoy the quiet, Citizen.</span></div>
        {/if}
        {#if gs.nextEvent}
          <div class="gs-kv">
            <span class="nx"
              >Next: {#if gs.nextEvent.url}<a href={gs.nextEvent.url} target="_blank" rel="noopener"
                  >{gs.nextEvent.name} ↗</a
                >{:else}{gs.nextEvent.name}{/if}</span
            >
            {#if gs.nextEvent.start}<span class="v">{shortDay(gs.nextEvent.start)}</span>{/if}
          </div>
        {/if}
      </div>
    {:else}
      <p class="gs-wait">
        {loaded
          ? "Comms are quiet right now. Game status shows here once openhangar.space answers."
          : 'Tuning the comms array…'}
      </p>
    {/if}
    <p class="gs-src">From openhangar.space</p>
  </div>
</div>

<style>
  .gs-wrap {
    display: inline-flex;
  }
  .gs-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 36px;
    padding: 0 10px 0 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    font: 500 13px var(--font-data);
    white-space: nowrap;
    cursor: pointer;
  }
  .gs-pill:hover,
  .gs-pill.open {
    border-color: var(--accent-line);
  }
  .gs-pill:focus-visible {
    outline: 2px solid var(--accent-line);
    outline-offset: 2px;
  }
  .dot {
    display: inline-block;
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--faint);
  }
  .dot.ok {
    background: var(--good);
    box-shadow: 0 0 0 3px var(--good-soft);
  }
  .dot.degraded {
    background: var(--warn);
    box-shadow: 0 0 0 3px var(--warn-soft);
  }
  .dot.down {
    background: var(--bad);
    box-shadow: 0 0 0 3px var(--bad-soft);
  }
  .gs-menu {
    width: 300px;
    max-width: calc(100vw - 16px);
    gap: 0;
    padding: 14px 16px 12px;
  }
  .gs-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }
  .gs-head h3 {
    margin: 0;
    font: 600 15px var(--font-head);
    color: var(--head);
  }
  .gs-sys {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    color: var(--muted);
    text-decoration: none;
    text-align: right;
  }
  a.gs-sys:hover {
    color: var(--link);
  }
  .gs-row {
    padding: 8px 0;
  }
  .gs-row + .gs-row {
    border-top: 1px solid var(--line);
  }
  .gs-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    font-size: 13.5px;
  }
  .gs-top b {
    font: 600 15px var(--font-head);
    color: var(--head);
  }
  .ch {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 9px;
    border-radius: 50%;
    background: var(--good);
  }
  .ch.test {
    background: none;
    border: 2px solid var(--warn);
    width: 9px;
    height: 9px;
  }
  .gs-sub {
    margin-top: 2px;
    padding-left: 17px;
    font-size: 12px;
    color: var(--muted);
  }
  .gs-more {
    display: inline-block;
    margin-top: 4px;
    font: 600 13.5px var(--font-body);
    color: var(--link);
    text-decoration: none;
  }
  .gs-more:hover,
  .gs-kv a:hover {
    text-decoration: underline;
  }
  .gs-evs {
    margin-top: 10px;
    border-top: 1px solid var(--line-2);
  }
  .gs-kv {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 8px 0 0;
    font-size: 13px;
  }
  .gs-kv a {
    color: var(--text);
    text-decoration: none;
  }
  .ev {
    font-weight: 600;
    color: var(--head) !important;
    min-width: 0;
  }
  .nx {
    color: var(--muted);
    min-width: 0;
  }
  .oh-q {
    color: var(--muted);
  }
  .v {
    flex: none;
    font-size: 12.5px;
    color: var(--muted);
    white-space: nowrap;
  }
  .gs-wait {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-wrap: pretty;
  }
  .gs-src {
    margin: 10px 0 0;
    font-size: 11.5px;
    color: var(--faint);
  }
  @media (max-width: 680px) {
    .gs-pill {
      height: 32px;
      padding: 0 10px;
    }
  }
</style>
