<script>
  // Wishlist Watch: your wishlist with what RSI's store had at the last check
  // (openhangar.space's store catalog, matched on your machine): In Store Now
  // (price, Warbond savings in green, Buy at RSI), Not on Sale or Sold Out. Shows
  // the LAST check ("Checked 2 days ago") until the next one; only Check Now (or
  // Scan → Store) asks, never anything by itself. Rows are generic items
  // (ui/lib/wish-watch.js): ships, packs, paints, gear, add-ons and CCUs.
  import { SvelteMap } from 'svelte/reactivity';
  import { app, OH, version } from '../lib/app.svelte.js';
  import { checkedAgo, wishRow, wishSummary } from '../lib/wish-watch.js';

  const SHOW = 5;
  const a = app();
  const d = $derived.by(() => {
    version.n;
    const s = a.store;
    const raw = s.wishWatchRows();
    const rows = raw.map((r) => ({ ...wishRow(r), lookup: r.lookup || r.name }));
    return {
      rows: rows.slice(0, SHOW),
      more: Math.max(0, rows.length - SHOW),
      total: rows.length,
      sum: wishSummary(rows),
      at: s.wishWatch.at,
      checking: s.wishWatch.checking,
    };
  });
  // Ship art for rows without a picture (cached by lib.js, like Latest Acquisitions).
  const art = new SvelteMap();
  $effect(() => {
    for (const r of d.rows) {
      if (r.img || !r.lookup || art.has(r.lookup) || (r.kind !== 'ship' && r.kind !== 'ccu')) continue;
      art.set(r.lookup, '');
      OH()
        .getShipImage(r.kind === 'ccu' ? r.to : r.lookup)
        .then((url) => url && art.set(r.lookup, url));
    }
  });
  const usd = (n) => (n == null ? '' : a.dollars(n));
  // Ticks so "Checked 2 minutes ago" keeps up while Home stays open.
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 60e3);
    return () => clearInterval(t);
  });
  const CHIP = { in: 'now', pack: 'wb', out: 'off', soldout: 'off', unknown: 'off' };
</script>

<section class="oh-p ww" id="oh-wishwatch">
  <div class="oh-ph"><h3>Wishlist Watch</h3><a class="act" href="#store">Wishlist →</a></div>
  {#if !d.total}
    <div class="ww-empty">
      <p>Your wishlist is empty. Add anything from Find in Store on the Store page.</p>
      <a class="oh-more" href="#store">Find in Store →</a>
    </div>
  {:else}
    <div class="ww-sum">
      {#if d.at}
        <span><b>{d.sum.on} of {d.sum.total}</b> on sale on their own</span>
        <span id="ww-checked" title={new Date(d.at).toLocaleString()}>Checked {checkedAgo(d.at, now)}</span>
      {:else}
        <span><b>{d.total}</b> on your wishlist</span><span id="ww-checked">Not checked yet</span>
      {/if}
    </div>
    {#if !d.at}
      <p class="ww-hint">Press Check Now to see which ones are in RSI's store. Nothing is checked in the background.</p>
    {/if}
    <div class="ww-list">
      {#each d.rows as r, i (r.lookup + i)}
        <div class="wl" data-status={r.status}>
          {#if r.img || art.get(r.lookup)}
            <img class="th" src={r.img || art.get(r.lookup)} alt="" loading="lazy" />
          {:else}
            <span class="th"></span>
          {/if}
          <span class="mid">
            <span class="n" title={r.name}
              >{#if r.kind === 'ccu' && r.from && r.to}{r.from} <span class="arrow">→</span> {r.to}{:else}{r.name}{/if}</span
            >
            <span class="sb">
              <span class="badge {r.kind}">{r.kindLabel}</span>
              {#if d.at}<span class="chip {CHIP[r.status]}">{r.statusLabel}</span>{/if}
            </span>
          </span>
          <span class="r">
            {#if r.status === 'in'}
              {#if r.warbond}
                <b><span class="was">{usd(r.price)}</span>{usd(r.warbond)}</b>
                <span class="save">Warbond, save {usd(r.price - r.warbond)}</span>
              {:else if r.price}<b>{usd(r.price)}</b>{/if}
              {#if r.buyable}<a class="buy" href={r.url} target="_blank" rel="noopener">Buy at RSI ↗</a>{/if}
            {:else if r.price}
              <b class="dim" title="Usual price">{usd(r.price)}</b>
            {/if}
          </span>
        </div>
      {/each}
    </div>
    {#if d.more}<a class="oh-more" href="#store">All {d.total} on Your Wishlist →</a>{/if}
    <div class="ww-foot">
      <button type="button" class="btn sm" id="ww-check" disabled={d.checking} onclick={() => a.store.checkWishlist()}
        >{d.checking ? 'Checking…' : 'Check Now'}</button
      >
      <span class="ww-note">Reads the store list only when you press it, one request for everything.</span>
    </div>
  {/if}
</section>

<style>
  .ww {
    display: flex;
    flex-direction: column;
  }
  .act {
    font-size: 13px;
    text-decoration: none;
  }
  .ww-sum {
    display: flex;
    justify-content: space-between;
    gap: 4px 10px;
    flex-wrap: wrap;
    margin: -4px 0 4px;
    font-size: 13px;
    color: var(--muted);
  }
  .ww-sum b {
    color: var(--head);
    font-weight: 600;
  }
  .ww-hint {
    margin: 4px 0 8px;
    font-size: 13px;
    color: var(--muted);
    text-wrap: pretty;
  }
  .wl {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 9px 0;
  }
  .wl + .wl {
    border-top: 1px solid var(--line);
  }
  .th {
    width: 56px;
    height: 36px;
    border-radius: var(--r-sm);
    object-fit: cover;
    background: var(--panel-2);
  }
  .mid {
    min-width: 0;
  }
  .n {
    display: block;
    font-weight: 600;
    color: var(--head);
    font-size: 14.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .arrow {
    color: var(--muted);
  }
  .sb {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 3px;
  }
  .chip {
    font: 600 11px var(--font-head);
    padding: 1px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .chip.now {
    color: var(--good);
    background: var(--good-soft);
  }
  .chip.wb {
    color: var(--t-pack);
    background: var(--t-pack-soft);
  }
  .chip.off {
    color: var(--muted);
    background: var(--panel-2);
  }
  .r {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    white-space: nowrap;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .r b {
    color: var(--head);
    font: 600 14px var(--font-body);
  }
  .r b.dim {
    color: var(--muted);
    font-weight: 400;
  }
  .was {
    color: var(--muted);
    font-weight: 400;
    text-decoration: line-through;
    margin-right: 5px;
  }
  .save {
    color: var(--good);
    font: 600 12px var(--font-body);
    margin-top: 1px;
  }
  .buy {
    display: inline-flex;
    align-items: center;
    height: 26px;
    margin-top: 4px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    background: var(--accent);
    color: #fff !important;
    font: 500 12.5px var(--font-head);
    text-decoration: none;
  }
  .buy:hover {
    background: var(--accent-hover);
  }
  .ww-foot {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .ww-list + .ww-foot,
  .oh-more + .ww-foot {
    margin-top: auto;
  }
  .ww-list {
    margin-bottom: 12px;
  }
  .btn.sm {
    flex: none;
    height: 30px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    color: var(--text);
    font: 500 13px var(--font-head);
    cursor: pointer;
  }
  .btn.sm:hover:not(:disabled) {
    border-color: var(--accent-line);
  }
  .btn.sm:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .ww-note {
    font-size: 12.5px;
    color: var(--muted);
    line-height: 1.35;
    text-wrap: pretty;
  }
  .ww-empty p {
    margin: 0 0 4px;
    font-size: 14px;
    color: var(--muted);
    text-wrap: pretty;
  }
</style>
