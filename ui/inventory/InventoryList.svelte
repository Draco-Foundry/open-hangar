<script>
  // Inventory's list, mounted into #results (which Inventory.svelte moves into its
  // list column): the cards in Gallery / Compact / List, one section per type when
  // Group by Type is on, or the Market sale sheet. Data from OHApp.inv.list();
  // redraws on 'oh:home'. Big lists draw a screenful first (progress.svelte.js).
  import { onDestroy } from 'svelte';
  import { app, version } from '../lib/app.svelte.js';
  import CardGrid from '../lib/CardGrid.svelte';
  import { Progressive, idsOf } from '../lib/progress.svelte.js';
  import Market from './Market.svelte';

  const inv = () => app().inv;
  const d = $derived.by(() => {
    version.n;
    return inv().list();
  });
  const cards = $derived(!d.empty && d.shown.length && d.layout !== 'market');

  const prog = new Progressive();
  $effect.pre(() => {
    if (cards) prog.update(idsOf(d.shown), d.shown.length);
  });
  onDestroy(() => prog.stop());

  // Where each section starts in the whole list, to share out the cards drawn so far.
  const starts = $derived.by(() => {
    let at = 0;
    return (d.sections || []).map((s) => (at += s.items.length) - s.items.length);
  });
</script>

{#if d.empty}
  {@const quip = inv().emptyQuip()}
  <div class="empty">{quip} Hit Scan at the top to fill it.</div>
{:else if !d.shown.length}
  <div class="empty">Nothing in your hangar matches those filters. Loosen them up, pilot.</div>
{:else if d.layout === 'market'}
  <Market />
{:else}
  <div class="market-toolbar">
    <div class="result-count">Showing {d.shown.length} of {d.total}</div>
    <div class="market-actions">
      <label class="mk-toggle inv-group-toggle"
        ><input
          type="checkbox"
          class="inv-group"
          checked={d.group}
          onchange={(e) => inv().setGroupByType(e.currentTarget.checked)}
        /> Group by Type</label
      >
    </div>
  </div>
  {#if d.sections}
    {#each d.sections as s, i (s.key)}
      {#if prog.n > starts[i]}
        <section class="inv-section">
          <h3 class="market-title">{s.label}<span class="market-n">{s.items.length}</span></h3>
          <CardGrid items={s.items} list="inv" layout={d.layout} limit={prog.n - starts[i]} />
        </section>
      {/if}
    {/each}
  {:else}
    <CardGrid items={d.shown} list="inv" layout={d.layout} limit={prog.n} />
  {/if}
{/if}
