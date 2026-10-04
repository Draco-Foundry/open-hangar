<script>
  // Stats: eight tabs over your hangar (ported from the classic renderStats, same
  // look). Draws only while the Stats page is open; the dashboard fires 'oh:home'
  // when it opens and whenever its data changes (scan, prices, currency, tab).
  // Tab buttons carry data-stats-tab: the dashboard's click handler remembers the
  // choice (uiStatsTab), the same one Home's links use to open a tab.
  import { app, OH, version } from '../lib/app.svelte.js';
  import Overview from './Overview.svelte';
  import Value from './Value.svelte';
  import Fleet from './Fleet.svelte';
  import Collection from './Collection.svelte';
  import Buybacks from './Buybacks.svelte';
  import TopLists from './TopLists.svelte';
  import Spending from './Spending.svelte';
  import History from './History.svelte';

  const a = app();
  const PAGES = {
    overview: Overview,
    value: Value,
    fleet: Fleet,
    collection: Collection,
    buybacks: Buybacks,
    top: TopLists,
    spending: Spending,
    history: History,
  };
  const view = $derived.by(() => {
    version.n;
    if (a.view !== 'stats') return null;
    if (!a.state.items.length) return { empty: `${OH().quip('emptyHangar')} Hit Scan at the top to fill it.` };
    return { tab: PAGES[a.state.statsTab] ? a.state.statsTab : 'overview' };
  });
  const Page = $derived(view && view.tab ? PAGES[view.tab] : null);
</script>

{#if view && view.empty}
  <div class="empty">{view.empty}</div>
{:else if view}
  <div class="layout-toggle stats-tabs" role="tablist">
    {#each a.statsTabs as [key, label] (key)}
      <button role="tab" data-stats-tab={key} aria-selected={key === view.tab} class={key === view.tab ? 'active' : ''}>{label}</button>
    {/each}
  </div>
  <Page />
{/if}
