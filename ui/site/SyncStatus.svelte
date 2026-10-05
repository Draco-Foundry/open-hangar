<script>
  // Beside the Scan button once connected (owner sign-off, 2026-10-05): a green dot
  // and "Synced 5:54 PM" (a short date when it's older), "Syncing…" while Sync Now
  // runs; the full time on hover. Narrow bars show just the dot.
  import { app, version } from '../lib/app.svelte.js';
  import { synced } from './when.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.site.state;
    const at = s.link && synced(s.link.lastSync);
    return {
      // While a scan runs the Scan button itself says "Syncing to Website…".
      shown: s.enabled && !!s.link && !a.top.bar.busy,
      syncing: s.syncing,
      // Two short lines, to fit the bar: "Synced" over "5:54 PM".
      text: s.syncing ? ['Syncing…'] : at ? ['Synced', at.short] : ['Connected'],
      title: s.syncing
        ? 'Sending your hangar to openhangar.space'
        : at
          ? `Synced to openhangar.space ${at.long}`
          : 'Connected to openhangar.space. Your next scan syncs.',
      done: !!at,
    };
  });
</script>

{#if d.shown}
  <span class="sync-status" id="sync-status" title={d.title} role="status"
    ><i class="ss-dot" class:on={d.done && !d.syncing} class:busy={d.syncing} aria-hidden="true"
    ></i><span class="ss-text"
      >{#each d.text as line, i (i)}<span>{line}</span>{i < d.text.length - 1 ? ' ' : ''}{/each}</span
    ></span
  >
{/if}
