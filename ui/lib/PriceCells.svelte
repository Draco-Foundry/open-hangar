<script>
  // The Market's "% of" and My Price cells (Inventory and Buy-Backs): two views of
  // one number, so typing either fills in the other (the price is what's saved,
  // locally, keyed by item). The fields keep their own text, so typing never
  // redraws the field under the cursor. Pricing a row means you're selling it:
  // onPick() ticks it (never an automatic untick).
  import { untrack } from 'svelte';
  import { app } from './app.svelte.js';

  let { key, melt, price = '', picked, pctLabel, onPick } = $props();

  let mine = $state(untrack(() => price));
  let pct = $state(untrack(() => app().pctOf(price, Number(melt))));

  // A new melt price (another currency): the % follows; your price stays.
  let lastMelt = untrack(() => melt);
  $effect.pre(() => {
    const m = melt;
    if (m === lastMelt) return;
    lastMelt = m;
    pct = app().pctOf(untrack(() => mine).trim(), Number(m));
  });

  function typed(v) {
    if (v && !picked) onPick();
  }
  function onPrice(e) {
    mine = e.currentTarget.value;
    const v = mine.trim();
    app().setMarketPrice(key, v);
    pct = app().pctOf(v, Number(melt));
    typed(v);
  }
  function onPct(e) {
    pct = e.currentTarget.value;
    const v = pct.trim();
    mine = app().priceAt(v, Number(melt));
    app().setMarketPrice(key, mine);
    typed(v);
  }
</script>

<td class="mk-pct"
  ><input
    class="mk-pct-in"
    type="text"
    inputmode="decimal"
    value={pct}
    placeholder="%"
    aria-label={pctLabel}
    oninput={onPct}
  /></td
>
<td class="mk-mine"
  ><input
    class="mk-price"
    type="text"
    inputmode="decimal"
    value={mine}
    placeholder="$"
    aria-label="My price"
    oninput={onPrice}
  /></td
>
