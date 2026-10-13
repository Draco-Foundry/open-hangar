<script>
  // Developers → Saved Accounts: every RSI account with data in this browser. The list
  // is loaded by renderProfiles() in src/dashboard.js (on this page and at start-up).
  import { app, version } from '../lib/app.svelte.js';

  const list = $derived.by(() => {
    version.n;
    return app().dev.profiles;
  });
  const when = (p) => (p.scannedAt ? new Date(p.scannedAt).toLocaleDateString() : 'never scanned');
</script>

<div id="profiles" class="profiles">
  {#if list && !list.length}
    <p class="muted">No saved accounts yet. Scan and your hangar gets parked here.</p>
  {:else if list}
    {#each list as p (p.nickname)}
      <div class="profile-row">
        <span class="profile-name">{p.displayname || p.nickname}</span><span class="muted"
          >{p.pledges} pledges · {when(p)}</span
        >{#if p.active}<span class="badge good">signed in</span>{:else}<button
            class="btn-secondary profile-remove"
            data-nick={p.nickname}
            onclick={() => app().dev.removeProfile(p.nickname)}>Remove</button
          >{/if}
      </div>
    {/each}
  {/if}
</div>
