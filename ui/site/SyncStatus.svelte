<script>
  // The Synced dot on your portrait once connected (Top Bar Option A, owner
  // 2026-10-06; it used to be "Synced 5:54 PM" beside Scan): green once synced, blue
  // while it syncs, grey before the first sync. The portrait's hover text says
  // "Synced 5:54 PM" (shared through ui/lib/sync-note.svelte.js), and the portrait's
  // menu has the full line with Sync Now (SyncLine.svelte).
  import { app, version } from '../lib/app.svelte.js';
  import { syncNote } from '../lib/sync-note.svelte.js';
  import { synced } from './when.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.site.state;
    const at = s.link && synced(s.link.lastSync);
    return {
      shown: s.enabled && !!s.link,
      syncing: s.syncing,
      text: s.syncing ? 'Syncing…' : at ? `Synced ${at.short}` : 'Connected',
      title: s.syncing
        ? 'Sending your hangar to openhangar.space'
        : at
          ? `Synced to openhangar.space ${at.long}`
          : 'Connected to openhangar.space. Your next scan syncs.',
      done: !!at,
    };
  });

  $effect(() => {
    syncNote.text = d.shown ? (d.text === 'Connected' ? 'Connected to openhangar.space' : d.text) : '';
    return () => (syncNote.text = '');
  });
</script>

{#if d.shown}
  <span
    class="sync-dot"
    id="sync-status"
    class:on={d.done && !d.syncing}
    class:busy={d.syncing}
    title={d.title}><span class="sr-only">{d.text}</span></span
  >
{/if}
