<script>
  // Inventory's Market view: a sale sheet, one table per category (Items Name,
  // Insurance, Giftable, Melt Price, Store Price, % of Melt, My Price, Stock, RSI).
  // Identical pledges are stacked into one row (Stock). Ticking rows (no Select mode
  // needed) narrows the exports to them. Data from OHApp.inv.market().
  import { app, version } from '../lib/app.svelte.js';
  import MarketRow from './MarketRow.svelte';

  const inv = () => app().inv;
  const m = $derived.by(() => {
    version.n;
    return inv().market();
  });
  let status = $state(); // the exports' "CSV saved." line
</script>

<div class="market-toolbar">
  <div class="result-count">
    Showing {m.n} of {m.total} · Melt {m.melt}<span class="mk-selcount">{m.sel}</span>
  </div>
  <div class="market-actions">
    <label class="mk-toggle"
      ><input
        type="checkbox"
        class="mk-giftable-only"
        checked={m.giftableOnly}
        onchange={(e) => inv().setGiftableOnly(e.currentTarget.checked)}
      /> Giftable Only</label
    >
    <button class="mk-btn mk-export-csv" type="button" onclick={() => inv().exportCsv(status)}
      >Export CSV</button
    >
    <button class="mk-btn mk-export-img" type="button" onclick={() => inv().exportImage(status)}
      >Download Image</button
    >
    <span class="mk-export-status" aria-live="polite" bind:this={status}></span>
  </div>
</div>
{#if m.sections.length}
  <div class="market">
    {#each m.sections as s (s.key)}
      <section class="market-section">
        <h3 class="market-title">{s.label}<span class="market-n">{s.rows.length}</span></h3>
        <table class="market-table">
          <thead>
            <tr>
              <th class="mk-sel"
                ><input
                  type="checkbox"
                  class="mk-pick-all"
                  aria-label="Pick all in {s.label}"
                  checked={s.rows.every((r) => r.picked)}
                  onchange={(e) =>
                    inv().pick(
                      s.rows.flatMap((r) => r.ids),
                      e.currentTarget.checked,
                    )}
                /></th
              >
              <th>Items Name</th>
              <th>Insurance</th>
              <th>Giftable</th>
              <th>Melt Price</th>
              <th title="Today's standard store price (ships, or a CCU's price gap)"
                >Store Price</th
              >
              <th title="Your price as a percent of melt value">% of Melt</th>
              <th>My Price</th>
              <th>Stock</th>
              <th title="Open the pledge in your RSI hangar, e.g. to screenshot its details"
                >RSI</th
              >
            </tr>
          </thead>
          <tbody>
            {#each s.rows as r (r.key)}<MarketRow {r} />{/each}
          </tbody>
        </table>
      </section>
    {/each}
  </div>
{:else}
  <div class="empty">No meltable pledges match the current filters.</div>
{/if}
