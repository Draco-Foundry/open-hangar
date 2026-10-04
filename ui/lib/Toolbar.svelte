<script>
  // One toolbar row for Inventory and Buy-Backs: search, sort, view, the
  // "Filters (n)" button while the sidebar is folded away, then the page's own
  // buttons (children). Ids are the page's own (`ids`), so each page keeps its
  // ids (#search, #sort, #layout on Inventory).
  let {
    ids = {},
    query = '',
    placeholder = 'Search by name…',
    searchLabel = 'Search',
    onQuery,
    sorts = [],
    sort,
    sortLabel = 'Sort',
    onSort,
    layouts = [],
    layout,
    onLayout,
    filtersHidden = false,
    filterCount = 0,
    onShowFilters,
    children,
  } = $props();
</script>

<div class="controls oh-toolbar">
  <input
    id={ids.search}
    type="search"
    {placeholder}
    autocomplete="off"
    aria-label={searchLabel}
    value={query}
    oninput={(e) => onQuery(e.currentTarget.value)}
  />
  <select
    id={ids.sort}
    aria-label={sortLabel}
    value={sort}
    onchange={(e) => onSort(e.currentTarget.value)}
  >
    {#each sorts as [v, label] (v)}<option value={v}>{label}</option>{/each}
  </select>
  <div class="layout-toggle" id={ids.layout}>
    {#each layouts as [v, label] (v)}
      <button
        type="button"
        data-layout={v}
        class:active={v === layout}
        aria-pressed={v === layout}
        onclick={() => onLayout(v)}>{label}</button
      >
    {/each}
  </div>
  {#if filtersHidden}
    <button type="button" class="mk-btn oh-fbtn" onclick={onShowFilters}
      >Filters{#if filterCount}<span class="oh-cnt">{filterCount}</span>{/if}</button
    >
  {/if}
  {@render children?.()}
</div>
