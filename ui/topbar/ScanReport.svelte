<script>
  // The scan report: when a scan ends with a problem it drops from the Scan button,
  // on whatever page you're on (owner sign-off, 2026-10-04). Signed out of RSI gets
  // its own note with Log In; otherwise one row per source, what came home or what
  // went wrong, and Scan Again, Copy Error Report and Report a Scan Problem. It
  // closes like the other menus (✕, Escape, a click elsewhere); the button says
  // Rough Landing until the next scan and opens it again. A report can bring its own
  // title and line (the website sync's "Scan Done, Not Synced"): just Scan Again.
  import { app } from '../lib/app.svelte.js';
  import { menus, menuClick, closeMenus } from './menus.svelte.js';

  let { r, panel = $bindable(), onClose } = $props();

  const HEAD = {
    out: {
      title: 'Hangar Doors Are Locked',
      sub: "You're not signed in to RSI, so there was nothing to scan. Log in, then scan again.",
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
  async function copy() {
    const ok = await app().top.copyReport(null);
    copied = ok
      ? 'Copied! Beam it to #bug-reports on Discord or a GitHub issue.'
      : 'Copy failed. See Developers → Error report.';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = ''), 4000);
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
    <span class="sr-icon">
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
      {:else}{@render warn(18)}{/if}
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
        <li class:bad={!row.ok}>
          <span class={row.ok ? 'sr-ok' : 'sr-warn'}>
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
            {:else}{@render warn(16)}{/if}
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
    {:else if r.title}
      <button type="button" class="sr-btn primary" onclick={scanAgain}>Scan Again</button>
    {:else}
      <button type="button" class="sr-btn primary" onclick={scanAgain}>Scan Again</button>
      <button type="button" class="sr-btn" onclick={copy}>Copy Error Report</button>
      <button type="button" class="sr-btn link" onclick={() => app().top.reportProblem()}
        >Report a Scan Problem</button
      >
    {/if}
  </div>
  {#if copied}
    <p class="sr-hint" role="status">{copied}</p>
  {:else if r.kind !== 'out' && !r.title}
    <p class="sr-hint">
      Report a Scan Problem opens a GitHub issue with the report filled in. Nothing is sent until
      you submit it.
    </p>
  {/if}
  {#if r.kind !== 'part' && !r.title && r.last}
    <p class="sr-kept">Your last scan ({r.last}) is still here, safe and sound.</p>
  {/if}
</div>
