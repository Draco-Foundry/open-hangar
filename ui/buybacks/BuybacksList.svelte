<script>
  // The Buy-Backs list, mounted into #buybacks-body (which Buybacks.svelte moves
  // into its list column): a Hangar Alert's "Showing the…" line, the Load Details
  // bar, then the cards (Gallery / Compact / List) or the Market reclaim sheet.
  // Data from OHApp.bb.list(); redraws on 'oh:home'. Big lists draw a screenful
  // first (progress.svelte.js).
  import { onDestroy } from 'svelte';
  import { app, version } from '../lib/app.svelte.js';
  import CardGrid from '../lib/CardGrid.svelte';
  import { Progressive, idsOf } from '../lib/progress.svelte.js';
  import DetailsBar from './DetailsBar.svelte';
  import BbMarket from './BbMarket.svelte';

  const d = $derived.by(() => {
    version.n;
    return app().bb.list();
  });
  const cards = $derived(!d.empty && d.list.length && d.layout !== 'market');

  const prog = new Progressive();
  $effect.pre(() => {
    if (cards) prog.update(idsOf(d.list), d.list.length);
  });
  onDestroy(() => prog.stop());
</script>

{#if d.empty}
  <div class="placeholder-view">
    <h2>Buy-Back Pledges</h2>
    <p class="muted">
      Melted something you miss? Your buy-backs show up here so you can claim them back. Hit
      <strong>Scan</strong> at the top to pull them in with your hangar.
    </p>
    <p class="muted">
      Buy-backs are read from
      <a
        href="https://robertsspaceindustries.com/account/buy-back-pledges"
        target="_blank"
        rel="noopener">RSI › Account › Buy-Back Pledges</a
      >, the same pages as your hangar.
    </p>
  </div>
{:else if !d.list.length}
  <div class="empty">No buy-backs match those filters. Loosen them up, pilot.</div>
{:else}
  {#if d.only}
    <div class="bb-only">
      Showing the {d.list.length}
      {d.only}
      <button type="button" class="btn-secondary" data-bb-all>Show All {d.total}</button>
    </div>
  {/if}
  <DetailsBar x={d.details} />
  {#if d.layout === 'market'}
    <BbMarket list={d.list} total={d.total} when={d.when} />
  {:else}
    <div class="result-count">
      Showing {d.list.length} of {d.total}{d.when ? ` · scanned ${d.when}` : ''}
    </div>
    <CardGrid items={d.list} list="bb" layout={d.layout} limit={prog.n} />
  {/if}
{/if}
