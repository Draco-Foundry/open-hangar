<script>
  // Inventory (0.3.0): the summary strip, one toolbar row, the filter sidebar
  // (Filters Pass, B2) beside the list, the active filters as pills, and saved
  // views. The list itself (#results: cards, or the Market sale sheet) is still
  // drawn by renderInventory() in src/dashboard.js; this page moves it into its
  // list column once, on mount. State lives in dashboard.js (OHApp.inv), because
  // the list, Select All and the exports all read the same filters.
  import { app, version } from '../lib/app.svelte.js';
  import SummaryStrip from '../lib/SummaryStrip.svelte';
  import Toolbar from '../lib/Toolbar.svelte';
  import FilterSidebar from '../lib/FilterSidebar.svelte';
  import ActivePills from '../lib/ActivePills.svelte';
  import ExportMenu from '../lib/ExportMenu.svelte';
  import SavedViews from './SavedViews.svelte';

  const SORTS = [
    ['default', 'Sort: Hangar order'],
    ['date-desc', 'Pledged: newest first'],
    ['date-asc', 'Pledged: oldest first'],
    ['value-desc', 'Value: high → low'],
    ['value-asc', 'Value: low → high'],
    ['store-desc', 'Store price: high → low'],
    ['name-asc', 'Name: A → Z'],
    ['name-desc', 'Name: Z → A'],
  ];
  const LAYOUTS = [
    ['gallery', 'Gallery'],
    ['compact', 'Compact'],
    ['list', 'List'],
    ['market', 'Market'],
  ];
  const EXPORTS = [
    { act: 'inv-csv', label: "CSV of What's Showing", hint: 'Just the rows your filters show' },
    { act: 'inv-image', label: 'Share Image', hint: 'Pick items, then Download Image' },
    { act: 'backup', label: 'Everything (JSON)', hint: 'Your full backup' },
  ];

  const inv = () => app().inv;
  const d = $derived.by(() => {
    version.n;
    const a = app();
    const i = a.inv;
    const empty = i.empty;
    const sum = empty ? null : i.summary();
    const f = empty ? null : i.filters();
    return {
      empty,
      stats: sum && [
        { label: 'Pledges', value: sum.nText },
        { label: 'Melt Value', value: a.bigMoney(sum.melt) },
        ...(sum.store ? [{ label: 'Store Value', value: a.bigMoney(sum.store) }] : []),
      ],
      note:
        sum && sum.n !== sum.total
          ? `Totals follow your filters (${sum.n} of ${sum.total})`
          : '',
      f,
      on: f ? f.active.length : 0,
      query: i.query,
      sort: i.sort,
      layout: i.layout,
      selecting: i.selecting,
      views: i.savedViews,
      viewKey: i.viewKey(),
      dollars: a.dollars,
    };
  });

  // Moves the classic list (#results) into the list column, once.
  function adopt(node) {
    const results = document.getElementById('results');
    if (results) node.appendChild(results);
  }
</script>

{#if !d.empty}
  <div id="inv-sum">
    <SummaryStrip title="Inventory" note={d.note} stats={d.stats} />
  </div>
{/if}
<div class="oh-side" class:folded={d.empty || d.f.folded}>
  {#if !d.empty}
    <FilterSidebar
      f={d.f}
      fmtMoney={d.dollars}
      onType={(k) => inv().toggleType(k)}
      onOption={(g, k) => inv().toggleOption(g, k)}
      onClearGroup={(g) => inv().clearGroup(g)}
      onCap={(v) => inv().setMeltMax(v)}
      onFold={(on) => inv().setFolded(on)}
      onGroupToggle={(g, open) => inv().setGroupOpen(g, open)}
    />
  {/if}
  <div class="oh-main">
    <Toolbar
      ids={{ search: 'search', sort: 'sort', layout: 'layout' }}
      query={d.query}
      searchLabel="Search Inventory"
      onQuery={(q) => inv().setQuery(q)}
      sorts={SORTS}
      sort={d.sort}
      sortLabel="Sort Inventory"
      onSort={(v) => inv().setSort(v)}
      layouts={LAYOUTS}
      layout={d.layout}
      onLayout={(v) => inv().setLayout(v)}
      filtersHidden={!d.empty && d.f.folded}
      filterCount={d.on}
      onShowFilters={() => inv().setFolded(false)}
    >
      <button
        id="select-toggle"
        class="mk-btn select-toggle"
        type="button"
        aria-pressed={d.selecting}
        title="Pick items to make a fleet image (e.g. a sale post)"
        onclick={() => inv().toggleSelecting()}>{d.selecting ? 'Done Selecting' : 'Select'}</button
      >
      <ExportMenu ids={{ button: 'inv-exp-btn', menu: 'inv-exp-menu' }} items={EXPORTS} />
    </Toolbar>
    {#if !d.empty}
      <ActivePills
        active={d.f.active}
        onRemove={(g, k) => inv().remove(g, k)}
        onClearAll={() => inv().clearAll()}
      />
      <SavedViews views={d.views} current={d.viewKey} />
    {/if}
    <div class="oh-list" use:adopt></div>
  </div>
</div>
