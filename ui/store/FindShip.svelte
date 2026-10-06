<script>
  // Find a Ship: type part of a name, press one to open its window (Add to
  // Wishlist, Add to RSI Cart, its store page). Not a price list: the full store
  // with every ship lives on the website. Rows open through the classic
  // [data-ship] handler, like every ship name.
  import { app, version } from '../lib/app.svelte.js';
  import ShipLink from './ShipLink.svelte';

  const MAX = 8;
  let q = $state('');
  let panel;

  const d = $derived.by(() => {
    version.n;
    const a = app();
    if (!a.store.active) return null;
    if (!a.state.catalog) return { loading: true };
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return { total: a.state.catalog.length, hits: null };
    const all = a.state.catalog.filter((v) => v.lname.includes(needle));
    // Names that start with what's typed first, then the rest A to Z.
    const starts = (v) => (v.lname.startsWith(needle) ? 0 : 1);
    const sorted = all.sort(
      (x, y) => starts(x) - starts(y) || (x.name || x.lname).localeCompare(y.name || y.lname),
    );
    return {
      total: a.state.catalog.length,
      more: Math.max(0, sorted.length - MAX),
      hits: sorted.slice(0, MAX).map((v) => ({
        name: v.name || v.lname,
        price: v.msrp ? a.dollars(v.msrp) : '',
      })),
    };
  });

  function onKey(e) {
    if (e.key === 'Escape') q = '';
    else if (e.key === 'Enter') panel.querySelector('.find-hits .ship-link')?.click();
  }
</script>

<div class="store-panel find-ship" bind:this={panel}>
  <div class="sp-head">
    <h3>Find a Ship</h3>
    <input
      id="find-ship"
      type="search"
      placeholder={d && d.total ? `Search ${d.total.toLocaleString('en-US')} ships…` : 'Search ships…'}
      autocomplete="off"
      aria-label="Find a Ship"
      bind:value={q}
      onkeydown={onKey}
    />
  </div>
  {#if d && d.loading}
    <p class="muted sp-empty">Loading the ship list…</p>
  {:else if d && d.hits && !d.hits.length}
    <p class="muted sp-empty">No ship by that name. Maybe it’s still a JPEG?</p>
  {:else if d && d.hits}
    <ul class="find-hits" aria-live="polite">
      {#each d.hits as h (h.name)}
        <li>
          <ShipLink name={h.name} />{#if h.price}<span class="find-price">{h.price}</span>{/if}
        </li>
      {/each}
    </ul>
    {#if d.more}
      <p class="muted value-note">{d.more} more. Type a bit more of the name.</p>
    {/if}
  {:else}
    <p class="muted value-note">
      Open any ship to add it to your wishlist, check RSI’s store or put an upgrade to it in your RSI cart.
    </p>
  {/if}
</div>
