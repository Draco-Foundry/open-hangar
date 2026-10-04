<script>
  // One stacked row of the Market sale sheet (`r` from OHApp.inv.market()).
  import { app } from '../lib/app.svelte.js';
  import PriceCells from '../lib/PriceCells.svelte';

  let { r } = $props();
  const pick = (on) => app().inv.pick(r.ids, on);
</script>

<tr class="mk-row" class:picked={r.picked} data-key={r.key} data-melt={r.melt}>
  <td class="mk-sel"
    ><input
      type="checkbox"
      class="mk-pick"
      checked={r.picked}
      aria-label="Pick for export"
      onchange={(e) => pick(e.currentTarget.checked)}
    /></td
  >
  <td class="mk-name">{r.name}</td>
  <td class="mk-ins">{r.ins}</td>
  <td class="mk-gift gift-{r.giftNo ? 'no' : 'yes'}">{r.gift}</td>
  <td class="mk-melt">{r.meltText}</td>
  <td class="mk-store">{#if r.store}{r.store}{:else}<span class="muted">—</span>{/if}</td>
  <PriceCells
    key={r.key}
    melt={r.melt}
    price={r.price}
    picked={r.picked}
    pctLabel="Percent of melt"
    onPick={() => pick(true)}
  />
  <td class="mk-stock">{r.stock}</td>
  <td class="mk-view"
    >{#if r.view}<a
        class="bb-reclaim"
        href={r.view.url}
        target="_blank"
        rel="noopener"
        title={r.view.title}>View ↗</a
      >{/if}</td
  >
</tr>
