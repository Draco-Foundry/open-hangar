<script>
  // Melt planner (Select mode's bar): what the picked pledges give back, and which
  // ship on your wishlist that buys, in the store or from your buy-backs (with
  // store credit a buy-back takes a token; cash ones don't). Owner's wording: no
  // "ticked", no "store credit if melted".
  import { app, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const picked = a.inv.picked();
    const total = picked.reduce((acc, p) => acc + (a.inv.isMeltable(p) ? p.value : 0), 0);
    if (!picked.length || !total) return null;
    const wish = s.wishlist || [];
    const priced = wish
      .map((name) => ({ name, price: (a.priceOf(name) || {}).msrp }))
      .filter((x) => x.price);
    const fits = priced.filter((x) => x.price <= total).sort((x, y) => y.price - x.price);
    // Wishlist ships waiting in your buy-backs at or under the total.
    const wl = new Set(wish.map((w) => String(w).toLowerCase()));
    const inBb = s.buybacks
      .map((b) => ({ ship: a.shipOf(a.resolveImageName(b)), price: a.inv.bbPrice(b) }))
      .filter(
        (x) => x.ship && wl.has(String(x.ship.name).toLowerCase()) && x.price && x.price <= total,
      )
      .sort((x, y) => y.price - x.price);
    const cheapest = [...priced].sort((x, y) => x.price - y.price)[0];
    return {
      total: a.dollars(total),
      noWish: !wish.length,
      fit: fits[0]
        ? {
            name: fits[0].name,
            price: a.dollars(fits[0].price),
            left: total - fits[0].price >= 1 ? a.dollars(total - fits[0].price) : '',
          }
        : null,
      cheapest: cheapest ? { name: cheapest.name, price: a.dollars(cheapest.price) } : null,
      bb: inBb[0] ? { name: inBb[0].ship.name, price: a.dollars(inBb[0].price) } : null,
      lti: picked.filter((p) => p.insurance === 'LTI').length,
    };
  });
</script>

<span class="sb-melt" id="sb-melt" hidden={!d}>
  {#if d}
    <b class="sb-total">{d.total}</b>
    {#if d.noWish}
      Add ships to your wishlist to see what this buys.
    {:else if d.fit}
      That buys a <b>{d.fit.name}</b> ({d.fit.price}) from your wishlist{#if d.fit.left}, with {d
          .fit.left} left{/if}.
    {:else if d.cheapest}
      Not enough for your wishlist yet: the cheapest is {d.cheapest.name} ({d.cheapest.price}).
    {/if}
    {#if d.bb}
      Or get the <b>{d.bb.name}</b> back from your buy-backs for {d.bb.price} (with store credit
      that takes a buy-back token; cash buy-backs don't).
    {/if}
    {#if d.lti}<span class="sb-warn">You'd lose LTI on {d.lti}.</span>{/if}
  {/if}
</span>
