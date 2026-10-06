<script>
  // The sync line at the top of your portrait's menu once connected (Top Bar Option
  // A, owner 2026-10-06): a dot, "Synced 5:54 PM" (the whole time on hover) and Sync
  // Now. The only Sync Now; the Scan ▾ menu keeps Connected as and Open My Hangar
  // (SyncMenu.svelte).
  import { app, version } from '../lib/app.svelte.js';
  import { synced } from './when.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.site.state;
    const at = s.link && synced(s.link.lastSync);
    return {
      shown: s.enabled && !!s.link,
      syncing: s.syncing,
      busy: a.top.bar.busy,
      done: !!at,
      text: s.syncing ? 'Syncing…' : at ? `Synced ${at.short}` : 'Connected. Your next scan syncs.',
      title: at ? `Synced to openhangar.space ${at.long}` : 'Connected to openhangar.space',
    };
  });
</script>

{#if d.shown}
  <div class="menu-sync" id="menu-sync" class:on={d.done && !d.syncing}>
    <i class="ss-dot" class:on={d.done && !d.syncing} class:busy={d.syncing} aria-hidden="true"
    ></i><span title={d.title}>{d.text}</span><button
      type="button"
      class="menu-item"
      id="menu-sync-now"
      disabled={d.syncing || d.busy}
      onclick={() => app().site.sync()}>Sync Now</button
    >
  </div>
{/if}
