<script>
  // Buy-Backs (0.3.0): the summary strip (count, tokens with the next date, below
  // store price), one toolbar row, the filter sidebar (Filters Pass, B2) beside the
  // list, and the active filters as pills. Same shared parts as Inventory (ui/lib).
  // The list itself (#buybacks-body: cards or the Market reclaim sheet, the Load
  // Details bar, a Hangar Alert's "Showing the…" line) is BuybacksList.svelte,
  // mounted into #buybacks-body by main.js; this page moves it into its list column
  // once, on mount. State lives in dashboard.js (OHApp.bb): the list and the CSV
  // export read the same filters. Buy-back details stay opt-in (never part of Scan).
  import { app, version } from '../lib/app.svelte.js';
  import SummaryStrip from '../lib/SummaryStrip.svelte';
  import Toolbar from '../lib/Toolbar.svelte';
  import FilterSidebar from '../lib/FilterSidebar.svelte';
  import ActivePills from '../lib/ActivePills.svelte';
  import ExportMenu from '../lib/ExportMenu.svelte';

  const SORTS = [
    ['date-desc', 'Date: newest first'],
    ['date-asc', 'Date: oldest first'],
    ['price-desc', 'Price: high to low'],
    ['price-asc', 'Price: low to high'],
    ['name-asc', 'Name: A → Z'],
    ['name-desc', 'Name: Z → A'],
    ['default', 'Scan order'],
  ];
  const LAYOUTS = [
    ['gallery', 'Gallery'],
    ['compact', 'Compact'],
    ['list', 'List'],
    ['market', 'Market'],
  ];
  const EXPORTS = [
    { act: 'bb-csv', label: "CSV of What's Showing", hint: 'Just the rows your filters show' },
    { act: 'backup', label: 'Everything (JSON)', hint: 'Your full backup' },
  ];

  const bb = () => app().bb;
  const d = $derived.by(() => {
    version.n;
    const a = app();
    const b = a.bb;
    const empty = b.empty;
    const sum = empty ? null : b.summary();
    const f = empty ? null : b.filters();
    return {
      empty,
      stats: sum && [
        { label: 'Buy-Backs', value: sum.n },
        {
          label: 'Tokens',
          value: sum.tokens,
          small: sum.next ? `next ${sum.next}` : '',
          title: sum.tokenTitle,
        },
        ...(sum.under ? [{ label: 'Below Store Price', value: sum.underText, good: true }] : []),
      ],
      f,
      on: f ? f.active.length : 0,
      query: b.query,
      sort: b.sort,
      layout: b.layout,
      dollars: a.dollars,
    };
  });

  // Moves the list (#buybacks-body) into the list column, once.
  function adopt(node) {
    const body = document.getElementById('buybacks-body');
    if (body) node.appendChild(body);
  }
</script>

{#if !d.empty}
  <div id="bb-sum">
    <SummaryStrip title="Buy-Backs" stats={d.stats} />
  </div>
{/if}
<div class="oh-side" class:folded={d.empty || d.f.folded}>
  {#if !d.empty}
    <FilterSidebar
      f={d.f}
      fmtMoney={d.dollars}
      onType={(k) => bb().toggleType(k)}
      onOption={(g, k) => bb().toggleOption(g, k)}
      onClearGroup={(g) => bb().clearGroup(g)}
      onCap={(v) => bb().setPriceMax(v)}
      onFold={(on) => bb().setFolded(on)}
      onGroupToggle={(g, open) => bb().setGroupOpen(g, open)}
    />
  {/if}
  <div class="oh-main">
    {#if !d.empty}
      <Toolbar
        ids={{ search: 'bb-search', sort: 'bb-sort', layout: 'bb-layout' }}
        query={d.query}
        placeholder="Search buy-backs…"
        searchLabel="Search Buy-Backs"
        onQuery={(q) => bb().setQuery(q)}
        sorts={SORTS}
        sort={d.sort}
        sortLabel="Sort Buy-Backs"
        onSort={(v) => bb().setSort(v)}
        layouts={LAYOUTS}
        layout={d.layout}
        onLayout={(v) => bb().setLayout(v)}
        filtersHidden={d.f.folded}
        filterCount={d.on}
        onShowFilters={() => bb().setFolded(false)}
      >
        <ExportMenu ids={{ button: 'bb-exp-btn', menu: 'bb-exp-menu' }} items={EXPORTS} />
      </Toolbar>
      <ActivePills
        active={d.f.active}
        onRemove={(g, k) => bb().remove(g, k)}
        onClearAll={() => bb().clearAll()}
      />
    {/if}
    <div class="oh-list" use:adopt></div>
  </div>
</div>
