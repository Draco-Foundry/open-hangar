<script>
  // The scan report: when a scan ends with a problem it drops from the Scan button,
  // on whatever page you're on (owner sign-off, 2026-10-04). Signed out of RSI gets
  // its own note with Log In and no Flight Log (#314); otherwise one row per source,
  // what came home or what went wrong, then Send Flight Log (copies the log and opens
  // #bug-reports on Discord), Scan Again and Report on GitHub (#315). It
  // closes like the other menus (✕, Escape, a click elsewhere); the button says
  // Rough Landing until the next scan and opens it again. A report can bring its own
  // title and line (the website sync's "Scan Done, Not Synced"): just Scan Again.
  // A calm one (`r.calm`, or a row's `calm`: the website's sync isn't open yet) is a
  // note, not a problem: an info sign in blue and Roger That to close it.
  import { app } from '../lib/app.svelte.js';
  import { menus, menuClick, closeMenus } from './menus.svelte.js';

  let { r, panel = $bindable(), onClose } = $props();

  const HEAD = {
    out: {
      title: 'Hangar Doors Are Locked',
      sub: "You're not logged in to RSI, so we can't see inside your hangar. Log in, come back and hit Scan All. Mind the elevators.",
    },
    part: { title: 'Rough Landing' },
    none: {
      title: 'Ship Exploded on Landing',
      sub: "Nothing made it home this time. Here's what happened.",
    },
  };
  const head = $derived(r.title ? { title: r.title, sub: r.sub } : HEAD[r.kind] || HEAD.part);
  const sub = $derived(
    r.kind === 'part' && !r.title
      ? r.bad > 1
        ? 'Most of it made it home. A few parts need another try.'
        : 'Most of it made it home. One part needs another try.'
      : head.sub,
  );

  let copied = $state('');
  let copyTimer;
  // Send Flight Log: copy it, open #bug-reports on Discord in a new tab. Pasting
  // stays with you (browsers don't allow auto-paste).
  async function send() {
    const ok = await app().top.sendFlightLog();
    copied = ok
      ? 'Flight log copied. Paste it in #bug-reports.'
      : 'Copy failed. Grab it from Developers → Flight Log.';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = ''), 6000);
  }
  function scanAgain() {
    closeMenus();
    app().top.scan();
  }
</script>

{#snippet warn(size)}
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M8 1.5 15 14H1L8 1.5Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <path d="M8 6v3.6M8 11.6v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
{/snippet}
{#snippet info(size)}
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M8 7.2v4M8 4.6v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={panel}
  id="scan-report"
  class="scan-menu scan-report"
  role="dialog"
  aria-labelledby="sr-title"
  hidden={menus.open !== 'report'}
  onclick={menuClick}
>
  <div class="sr-head">
    <span class="sr-icon" class:calm={r.calm}>
      {#if r.kind === 'out'}
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="7" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M10.6 10H18M15 10v3M17.4 10v2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      {:else if r.calm}{@render info(18)}{:else}{@render warn(18)}{/if}
    </span>
    <div class="sr-titles">
      <h3 id="sr-title">{head.title}</h3>
      <p>{sub}</p>
    </div>
    <button type="button" class="sr-x" aria-label="Close" onclick={onClose}>✕</button>
  </div>

  {#if r.rows.length}
    <ul class="sr-rows">
      {#each r.rows as row (row.name)}
        <li class:bad={!row.ok && !row.calm}>
          <span class={row.ok ? 'sr-ok' : row.calm ? 'sr-note' : 'sr-warn'}>
            {#if row.ok}
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 8.5l3 3 7-7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            {:else if row.calm}{@render info(16)}{:else}{@render warn(16)}{/if}
          </span>
          <span class="sr-src">{row.name}</span>
          <span class="sr-what">{row.text}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="sr-actions">
    {#if r.kind === 'out'}
      <a
        class="sr-btn primary"
        href="https://robertsspaceindustries.com/connect"
        target="_blank"
        rel="noopener">Log In to RSI ↗</a
      >
      <button type="button" class="sr-btn" onclick={scanAgain}>Scan Again</button>
    {:else if r.calm}
      <button type="button" class="sr-btn primary" onclick={onClose}>Roger That</button>
    {:else if r.title}
      <button type="button" class="sr-btn primary" onclick={scanAgain}>Scan Again</button>
    {:else}
      <button type="button" id="sr-send" class="sr-btn primary" onclick={send}
        >Send Flight Log <span class="sr-btn-hint">(opens Discord)</span></button
      >
      <button type="button" class="sr-btn" onclick={scanAgain}>Scan Again</button>
      <button type="button" class="sr-btn link" onclick={() => app().top.reportProblem()}
        >Report on GitHub ↗</button
      >
    {/if}
  </div>
  {#if copied}
    <p class="sr-hint" role="status">{copied}</p>
  {:else if r.kind !== 'out' && !r.title}
    <p class="sr-hint">
      Report on GitHub opens an issue with your flight log filled in. Nothing is sent until you
      submit it.
    </p>
  {/if}
  {#if r.kind !== 'part' && !r.title && r.last}
    <p class="sr-kept">Your last scan ({r.last}) is still here, safe and sound.</p>
  {/if}
</div>
