<script>
  // One row of the Buy-Backs Market (`r` from OHApp.bb.market()): each buy-back is
  // its own row (own insurance, own extras). The name opens its details.
  import { app } from '../lib/app.svelte.js';
  import PriceCells from '../lib/PriceCells.svelte';
  import BbPrice from '../lib/BbPrice.svelte';
  import Reclaim from '../lib/Reclaim.svelte';
  import ItemName from '../lib/ItemName.svelte';

  let { r } = $props();
  const pick = (on) => app().bb.pick([r.id], on);
</script>

<tr class="mk-row" class:picked={r.picked} data-id={r.id} data-key={r.key} data-melt={r.melt}>
  <td class="mk-sel"
    ><input
      type="checkbox"
      class="mk-pick"
      checked={r.picked}
      aria-label="Pick for total and export"
      onchange={(e) => pick(e.currentTarget.checked)}
    /></td
  >
  <td class="mk-name"
    ><button
      type="button"
      class="bb-open"
      title="See what's in it"
      onclick={() => app().bb.open(r.id)}
      ><ItemName x={r} /></button
    ></td
  >
  <td class="mk-ins">{r.ins}</td>
  <td class="mk-melt">{#if r.price}<BbPrice p={r.price} />{:else}—{/if}</td>
  <td class="mk-store">{#if r.store}{r.store}{:else}<span class="muted">—</span>{/if}</td>
  <td class="mk-vs" class:gain={r.gain}
    >{#if r.vs}{r.vs}{:else}<span class="muted">—</span>{/if}</td
  >
  <PriceCells
    key={r.key}
    melt={r.melt}
    price={r.mine}
    picked={r.picked}
    pctLabel="Percent of buy-back price"
    onPick={() => pick(true)}
  />
  <td class="mk-view">{#if r.reclaim}<Reclaim r={r.reclaim} />{:else}—{/if}</td>
</tr>
