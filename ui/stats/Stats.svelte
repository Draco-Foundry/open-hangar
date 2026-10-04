<script>
  // Stats: the tab row, then the picked tab. Ported from renderStats() as it looked
  // in 0.2.x (no signed-off redesign yet), so it reuses the dashboard's classes.
  // Tab clicks go through the classic [data-stats-tab] handler (setStatsTab), which
  // remembers the tab and fires 'oh:home'.
  import { app, OH, version } from '../lib/app.svelte.js';
  import Overview from './Overview.svelte';
  import Value from './Value.svelte';
  import Fleet from './Fleet.svelte';
  import Collection from './Collection.svelte';
  import Buybacks from './Buybacks.svelte';
  import TopLists from './TopLists.svelte';
  import Spending from './Spending.svelte';
  import History from './History.svelte';

  const TABS = {
    overview: Overview,
    value: Value,
    fleet: Fleet,
    collection: Collection,
    buybacks: Buybacks,
    top: TopLists,
    spending: Spending,
    history: History,
  };

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const tab = TABS[a.state.statsTab] ? a.state.statsTab : 'overview';
    return {
      // Nothing to work out while another page is showing.
      active: a.view === 'stats',
      empty: !a.state.items.length,
      quip: a.state.items.length ? '' : OH().quip('emptyHangar'),
      tabs: a.statsTabs,
      tab,
    };
  });
  const Tab = $derived(TABS[d.tab]);
</script>

{#if d.active}
  {#if d.empty}
    <div class="empty">{d.quip} Hit Scan at the top to fill it.</div>
  {:else}
    <div class="layout-toggle stats-tabs" role="tablist">
      {#each d.tabs as [key, label] (key)}
        <button
          role="tab"
          data-stats-tab={key}
          aria-selected={key === d.tab}
          class={key === d.tab ? 'active' : ''}>{label}</button
        >
      {/each}
    </div>
    <Tab />
  {/if}
{/if}
