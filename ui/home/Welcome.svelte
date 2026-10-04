<script>
  // First run (nothing scanned yet): a big welcome with Scan My Hangar. During the
  // first scan the button becomes a progress bar with the step under it (#170).
  // Signed out, the card above has the Log In button, so the note points there.
  import { app, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const scan = a.scanDetail;
    return {
      shown: a.welcomeReady && !s.items.length && !s.buybacks.length,
      loggedOut: a.loggedOut,
      scanning: a.scanning,
      progress: scan.text ? scan : null,
    };
  });
</script>

{#if d.shown}
  <section class="oh-welcome" id="oh-welcome">
    <h2>Welcome to Open Hangar, Citizen</h2>
    <p>
      Your whole Star Citizen hangar in one place: what it's worth, your buy-backs, your referrals
      and more. Everything stays on this computer, locked in your own hangar.
    </p>
    <button
      type="button"
      class="welcome-scan"
      id="welcome-scan"
      hidden={d.loggedOut || !!d.progress}
      disabled={d.scanning}
      onclick={() => app().scanAll()}>Scan My Hangar</button
    >
    <!-- The first scan's progress, in place of the button (#170). -->
    <div class="welcome-progress" id="welcome-progress" role="status" hidden={!d.progress}>
      <div class="wp-bar">
        <span class="wp-fill" id="wp-fill" style:width={d.progress ? `${d.progress.pct}%` : null}
        ></span>
      </div>
      <div class="wp-text" id="wp-text">{d.progress ? d.progress.text : ''}</div>
    </div>
    <p class="welcome-note" id="welcome-note">
      {#if d.loggedOut}
        First, log in to RSI with the button on the card above, then come back and hit Scan. Your
        hangar’s waiting.
      {:else}
        A big hangar takes about a minute, still faster than a Lorville elevator. To scan just part
        of it, use the ▾ next to Scan.
      {/if}
    </p>
  </section>
{/if}
