<script>
  // The Buy-Backs Market: one reclaim table per kind (Ships, CCUs, Paints, …), like
  // the Inventory Market. Tick rows to total and export them; My Price / % of the
  // buy-back price are saved alongside the Inventory ones.
  import { app, version } from '../lib/app.svelte.js';
  import BbRow from './BbRow.svelte';
  import { keyed } from '../lib/progress.svelte.js';

  let { list, total, when } = $props();
  const bb = () => app().bb;
  const sections = $derived.by(() => {
    version.n;
    return bb().market(list);
  });
  const sel = $derived.by(() => {
    version.n;
    return bb().selText();
  });
  let status = $state(); // the exports' "CSV saved." line
</script>

<div class="market-toolbar">
  <div class="result-count">
    Showing {list.length} of {total}{when ? ` · scanned ${when}` : ''}<span class="mk-selcount"
      >{sel}</span
    >
  </div>
  <div class="market-actions">
    <button class="mk-btn bb-export-csv" type="button" onclick={() => bb().exportCsv(status)}
      >Export CSV</button
    >
    <button class="mk-btn bb-export-img" type="button" onclick={() => bb().exportImage(status)}
      >Download Image</button
    >
    <span class="mk-export-status" aria-live="polite" bind:this={status}></span>
  </div>
</div>
<div class="market">
  {#each sections as s (s.key)}
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
                  bb().pick(
                    s.rows.map((r) => r.id),
                    e.currentTarget.checked,
                  )}
              /></th
            >
            <th>Items Name</th>
            <th>Insurance</th>
            <th title={TIPS.price}>Buy-Back Price</th>
            <th title={TIPS.store}>Store Price</th>
            <th title="Store price minus the buy-back price (needs Load details)">vs Store</th>
            <th title="Your price as a percent of the buy-back price">% of Price</th>
            <th>My Price</th>
            <th>Reclaim</th>
          </tr>
        </thead>
        <tbody>
          {#each keyed(s.rows) as x (x.k)}<BbRow r={x.item} />{/each}
        </tbody>
      </table>
    </section>
  {/each}
</div>

<script module>
  const TIPS = {
    price:
      "RSI's buy-back price once Load details has read it; before that, today's store price",
    store:
      "Today's store price of every ship inside (packs need Load details), or a CCU's price gap",
  };
</script>
