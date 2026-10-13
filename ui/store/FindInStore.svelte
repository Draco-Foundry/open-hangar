<script>
  // Find in Store: type part of a name to search RSI's store as openhangar.space's
  // catalog last saw it (ships, packs, paints, gear, add-ons and upgrades), plus every
  // ship in the ship list (the ones not on sale too). Add to Wishlist from a result;
  // a ship's name opens its window (Add to RSI Cart, its store page). An upgrade
  // shows From → To: pick the ship you'd start from and it's priced from there
  // (the edition's price minus that ship's). The search runs on your machine;
  // nothing you type is sent anywhere.
  import { app, version } from '../lib/app.svelte.js';
  import ShipLink from './ShipLink.svelte';

  const MAX = 8;
  const KIND = {
    ship: 'Ship',
    vehicle: 'Vehicle',
    pack: 'Pack',
    starter: 'Pack',
    paint: 'Paint',
    gear: 'Gear',
    addon: 'Add-On',
    subscriber: 'Add-On',
    other: 'Add-On',
    upgrade: 'CCU',
  };
  let q = $state('');
  let froms = $state({}); // upgrade item id → the ship it starts from
  let panel;

  const d = $derived.by(() => {
    version.n;
    const a = app();
    if (!a.store.active) return null;
    const s = a.store;
    const cat = s.catalog;
    const ships = a.state.catalog;
    if (!cat && !ships) return { loading: true };
    const items = cat ? cat.items : [];
    const total = items.length + (ships || []).length;
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return { total, hits: null };
    const name = (i) => (i.upgrade ? i.upgrade.to : i.name).toLowerCase();
    const found = items.filter((i) => name(i).includes(needle));
    // Ships in the list that aren't in the store right now: still worth wishing for.
    const inStore = found.filter((i) => i.kind === 'ship' || i.kind === 'vehicle');
    const offSale = (ships || []).filter(
      (v) => v.lname.includes(needle) && !inStore.some((i) => s.sameShip(i.name, v.name || v.lname)),
    );
    const starts = (n) => (n.startsWith(needle) ? 0 : 1);
    const all = [
      ...found.map((i) => ({ item: i, n: name(i) })),
      ...offSale.map((v) => ({ ship: v, n: v.lname })),
    ].sort((x, y) => starts(x.n) - starts(y.n) || x.n.localeCompare(y.n));
    const shipOptions = (ships || [])
      .filter((v) => v.msrp > 0)
      .map((v) => ({ name: v.name || v.lname, msrp: v.msrp }))
      .sort((x, y) => x.name.localeCompare(y.name));
    const hits = all.slice(0, MAX).map(({ item, ship }) => {
      if (ship) {
        const title = ship.name || ship.lname;
        return {
          key: 'ship:' + title,
          kind: 'Ship',
          cls: 'ship',
          ship: title,
          title,
          price: ship.msrp ? a.dollars(ship.msrp) : '',
          note: 'Not on Sale',
          entry: title,
        };
      }
      const wishKind = item.wishKind;
      const base = {
        key: item.id,
        kind: KIND[item.kind] || 'Add-On',
        cls: wishKind,
        title: item.name,
        note: item.inStore ? (item.warbond ? 'Warbond' : '') : 'Sold Out',
        price: a.dollars(item.price),
      };
      if (wishKind === 'ship') return { ...base, ship: item.name, entry: item.name };
      if (wishKind !== 'ccu')
        return {
          ...base,
          entry: { id: item.id, kind: wishKind, name: item.name, price: item.price, img: item.img || '' },
        };
      // An upgrade: priced from the ship you pick to start from.
      const to = item.upgrade.to;
      const top = Math.max(item.price, ...(cat.ships.find((x) => x.id === item.upgrade.toShipId)?.editions || []).map((e) => e.price));
      const options = shipOptions.filter((o) => o.msrp < top && !s.sameShip(o.name, to));
      const from = options.find((o) => o.name === froms[item.id]) || null;
      const cost = from ? s.upgradeCost(cat, item, from.msrp) : null;
      return {
        ...base,
        ccu: true,
        to,
        options,
        from: from ? from.name : '',
        price: cost ? a.dollars(cost.warbond || cost.price) : '',
        note: from ? (cost && cost.warbond ? 'Warbond' : base.note) : 'Pick a ship to start from',
        entry: cost
          ? {
              id: item.id,
              kind: 'ccu',
              name: `${from.name} to ${to}`,
              from: from.name,
              to,
              fromMsrp: from.msrp,
              price: cost.price,
              img: item.img || '',
            }
          : null,
      };
    });
    return {
      total,
      more: Math.max(0, all.length - MAX),
      hits: hits.map((h) => ({ ...h, wished: h.entry ? s.onWishlist(h.entry) : false })),
      noCatalog: !cat,
    };
  });

  function onKey(e) {
    if (e.key === 'Escape') q = '';
    else if (e.key === 'Enter') panel.querySelector('.fis-hits .ship-link')?.click();
  }
</script>

<div class="store-panel find-ship" bind:this={panel}>
  <div class="sp-head">
    <h3>Find in Store</h3>
    <input
      id="find-ship"
      type="search"
      placeholder={d && d.total ? `Search ${d.total.toLocaleString('en-US')} items…` : 'Search the store…'}
      autocomplete="off"
      aria-label="Find in Store"
      bind:value={q}
      onkeydown={onKey}
    />
  </div>
  {#if d && d.loading}
    <p class="muted sp-empty">Loading the store list…</p>
  {:else if d && d.hits && !d.hits.length}
    <p class="muted sp-empty">Nothing by that name. Maybe it’s still a JPEG?</p>
  {:else if d && d.hits}
    <ul class="fis-hits" aria-live="polite">
      {#each d.hits as h (h.key)}
        <li>
          <span class="badge {h.cls}">{h.kind}</span>
          <span class="fis-name">
            {#if h.ccu}
              <select
                class="fis-from"
                aria-label="Upgrade from"
                value={h.from}
                onchange={(e) => (froms = { ...froms, [h.key]: e.currentTarget.value })}
              >
                <option value="">From…</option>
                {#each h.options as o (o.name)}<option value={o.name}>{o.name}</option>{/each}
              </select>
              <span class="arrow">→</span>
              <ShipLink name={h.to} />
            {:else if h.ship}
              <ShipLink name={h.ship} text={h.title} />
            {:else}
              {h.title}
            {/if}
          </span>
          <span class="find-price"
            >{#if h.note}<span class="fis-note">{h.note}</span>{/if}{#if h.price}{h.note ? ' · ' : ''}{h.price}{/if}</span
          >
          <button
            type="button"
            class="btn sm fis-wish"
            disabled={!h.entry}
            aria-pressed={h.wished}
            onclick={() => app().store.toggleWish(h.entry)}
            >{h.wished ? 'On Your Wishlist' : 'Add to Wishlist'}</button
          >
        </li>
      {/each}
    </ul>
    {#if d.more}
      <p class="muted value-note">{d.more} more. Type a bit more of the name.</p>
    {/if}
    {#if d.noCatalog}
      <p class="muted value-note">The store list is still on its way, so only ships show for now.</p>
    {/if}
  {:else}
    <p class="muted value-note">
      Search ships, packs, paints, gear, add-ons and upgrades, then add them to your wishlist. Open a
      ship for its window, with Add to RSI Cart.
    </p>
  {/if}
</div>

<style>
  .fis-hits {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .fis-hits li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 6px 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .fis-name {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    text-wrap: pretty;
  }
  .fis-from {
    max-width: 14em;
  }
  .arrow {
    color: var(--muted);
  }
  .fis-note {
    color: var(--muted);
  }
  .fis-wish {
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .fis-hits li {
      grid-template-columns: auto minmax(0, 1fr);
    }
  }
</style>
