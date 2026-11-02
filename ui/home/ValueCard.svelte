<script>
  // Melt Value: everything you own at melt (OH.meltValue, the website's Melt Value; owner,
  // 2026-11-02: Melt Value everywhere, no store-price total; Store Credit is not in it), what
  // it's made of, so the parts add up to the figure, Most Valuable at melt, and clickable
  // counts that open Inventory filtered. The value trend lives on Stats → History (owner: no chart on Home).
  import { app, OH, version } from '../lib/app.svelte.js';
  import { SvelteMap } from 'svelte/reactivity';
  import { exactCount, plural, shortCount } from '../lib/format.js';
  import { insChip, mostValuable } from '../lib/most-valuable.js';

  // Rows in the Most Valuable list: enough that the card ends level with Latest
  // Acquisitions (five rows) at 1440 and 1100 wide.
  const TOP_N = 3;
  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const items = s.items;
    const v = a.hangarValue();
    const acct = OH().meltValue(items, s.storeCredit);
    const melt = OH().totalValue(items);
    return {
      scannedAt: s.scannedAt || null,
      store: acct && acct.total ? acct.total : null,
      // What the total is made of; parts that are $0 are left out.
      parts: acct
        ? [
            ['Ships', acct.ships],
            ['CCUs', acct.ccus],
            ['Other', acct.other],
          ].filter(([, n]) => n >= 0.5)
        : [],
      melt,
      // Most Valuable: the top ship pledges at melt (owner picked this to fill the card,
      // 2026-10-06).
      top: mostValuable(items, v, TOP_N).map((r) => ({
        ...r,
        name: a.cardName(r.p),
        full: a.plainName(r.p),
        ins: insChip(r.p.insurance),
        img: a.realImage(r.p.image),
        resolve: a.resolveImageName(r.p),
      })),
      // Ships · CCUs · Paints · Other, in the usual category order (owner, 2026-10-09):
      // Ships counts every ship (a pack with two counts two), not pledges; Other's
      // hover names what it holds. No LTI, pledge or buy-back counts here.
      counts: countsOf(items),
    };
  });
  function countsOf(items) {
    const of = (k) => items.filter((p) => p.kind === k).length;
    // Every ship in every pledge, as Stats counts them (OH.fleetStats), without
    // looking each one up: the count is all this card needs.
    const ships = items.reduce(
      (n, p) => n + (p.contents || []).filter(OH().isShipItem).length,
      0,
    );
    const shipPledges = items.filter((p) => p.containsShip).length;
    const others = [
      ['addon', 'add-on', 'add-ons'],
      ['coupon', 'coupon', 'coupons'],
      ['other', 'other', 'other'],
    ].map(([k, one, many]) => [of(k), one, many]);
    const otherN = others.reduce((n, [c]) => n + c, 0);
    return [
      {
        key: 'ship',
        n: ships,
        one: 'ship',
        many: 'ships',
        hint: `${ships} ${ships === 1 ? 'ship' : 'ships'} in ${shipPledges} ${shipPledges === 1 ? 'pledge' : 'pledges'}`,
      },
      { key: 'ccu', n: of('ccu'), one: 'CCU', many: 'CCUs' },
      { key: 'paint', n: of('paint'), one: 'paint', many: 'paints' },
      {
        // Opens the whole Inventory: Other spans three kinds there.
        key: 'other-all',
        n: otherN,
        one: 'other',
        many: 'other',
        hint: others
          .filter(([c]) => c > 0)
          .map(([c, one, many]) => `${c} ${c === 1 ? one : many}`)
          .join(', '),
      },
    ].filter((c) => c.n > 0);
  }
  const a = app();

  // "Updated today, 9:45 AM"; after a week it turns amber: "Updated 8 days ago · Rescan?".
  const upd = $derived.by(() => {
    if (!d.scannedAt) return null;
    const t = new Date(d.scannedAt);
    const days = Math.floor((Date.now() - d.scannedAt) / 86400000);
    const time = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const day0 = new Date();
    day0.setHours(0, 0, 0, 0);
    const cal = Math.round((day0 - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
    if (days >= 7) return { text: `Updated ${days} days ago`, stale: true, full: t.toLocaleString() };
    const when =
      cal <= 0
        ? 'today'
        : cal === 1
          ? 'yesterday'
          : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { text: `Updated ${when}, ${time}`, stale: false, full: t.toLocaleString() };
  });
  // The top bar's Scan button (runs whatever its menu has ticked).
  const rescan = (e) => {
    e.preventDefault();
    document.getElementById('scan-home')?.click();
  };

  // Pledges without an RSI picture get the ship's wiki art (like Latest Acquisitions).
  const art = new SvelteMap();
  $effect(() => {
    for (const r of d.top) {
      if (r.img || !r.resolve || art.has(r.resolve)) continue;
      art.set(r.resolve, '');
      OH()
        .getShipImage(r.resolve)
        .then((url) => url && art.set(r.resolve, url));
    }
  });

  function open(c, e) {
    e.preventDefault();
    if (c.key === 'buybacks') location.hash = '#buybacks';
    else a.showInventory(c.key);
  }
</script>

<section class="oh-p value">
  <div class="top">
    <div class="oh-lbl">Melt Value</div>
    {#if upd}
      <div class="upd" class:stale={upd.stale} title="Last scan: {upd.full}">
        {upd.text}{#if upd.stale}
          · <a href="#home" onclick={rescan}>Rescan?</a>{/if}
      </div>
    {/if}
  </div>
  <div class="headline">
    {#if d.store != null}
      <div class="big" title={a.dollars(d.store)}>{a.bigMoney(d.store)}</div>
    {:else}
      <div class="big" title={a.money(d.melt)}>{a.bigMoney(d.melt)}</div>
    {/if}
  </div>
  {#if d.store != null && d.parts.length > 1}
    <div class="parts">
      {#each d.parts as [label, n], i (label)}{#if i}<span class="sep">·</span>{/if}<span>{label} <b>{a.bigMoney(n)}</b></span>{/each}
    </div>
  {/if}
  {#if d.top.length}
    <div class="mv" aria-label="Most Valuable">
      <div class="mv-h">Most Valuable</div>
      {#each d.top as r (r.id)}
        <button type="button" class="mv-row" onclick={() => a.openItem(r.id)} title={r.full}>
          {#if r.img || art.get(r.resolve)}
            <img class="th" src={r.img || art.get(r.resolve)} alt="" loading="lazy" />
          {:else}
            <span class="th"></span>
          {/if}
          <span class="nm">
            <span class="n">{r.name}</span>
            {#if r.ins}<span class="ins" title="Insurance">{r.ins}</span>{/if}
          </span>
          <span class="meta">
            <b title={'Melt value: ' + a.dollars(r.paid)}>{a.bigMoney(r.paid)}</b>
          </span>
        </button>
      {/each}
    </div>
  {/if}
  <div class="counts">
    {#each d.counts as c (c.key)}
      <a href={c.key === 'buybacks' ? '#buybacks' : '#inventory'} title={c.hint || `${exactCount(c.n)} ${plural(c.n, c.one, c.many)}`} onclick={(e) => open(c, e)}
        ><b>{shortCount(c.n)}</b> {plural(c.n, c.one, c.many)}</a
      >
    {/each}
  </div>
</section>

<style>
  .value {
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .upd {
    font-size: 13px;
    color: var(--muted);
  }
  .upd.stale {
    color: var(--warn);
  }
  .upd a {
    color: var(--warn);
    font-weight: 600;
  }
  .big {
    font: 500 46px/1.05 var(--font-data);
    color: var(--head);
    letter-spacing: -0.03em;
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .parts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .parts b {
    color: var(--text);
    font-weight: 600;
  }
  .parts .sep {
    opacity: 0.6;
  }
  .headline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    margin-top: 6px;
  }
  .headline .big {
    margin-top: 0;
  }
  /* Most Valuable: rows shaped like Latest Acquisitions' so the two cards match. */
  .mv {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .mv-h {
    font: 700 12px var(--font-head);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .mv-row {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    width: calc(100% + 16px);
    margin-inline: -8px;
    padding: 9px 8px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .mv-row:hover {
    background: var(--panel-2);
  }
  .mv-row + .mv-row {
    box-shadow: 0 -1px 0 var(--line);
  }
  .th {
    width: 64px;
    height: 40px;
    border-radius: var(--r-sm);
    object-fit: cover;
    background: var(--panel-2);
  }
  .nm {
    min-width: 0;
    display: grid;
    gap: 3px;
    justify-items: start;
  }
  .n {
    max-width: 100%;
    font-weight: 600;
    color: var(--head);
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ins {
    font: 600 11px var(--font-head);
    color: var(--muted);
    border: 1px solid var(--line-2);
    border-radius: 999px;
    padding: 1px 7px;
    white-space: nowrap;
  }
  .meta {
    text-align: right;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .meta b {
    display: block;
    color: var(--text);
    font-weight: 600;
  }
  @media (max-width: 480px) {
    .mv-row {
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: 10px;
    }
    .th {
      width: 52px;
      height: 34px;
    }
  }
  /* The counts are the card's footer: pinned to the bottom so they line up with the
     other cards' footers in the row. */
  .counts {
    margin-top: auto;
    padding-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    font-size: 15px;
  }
  .counts a {
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--line-2);
    padding-bottom: 1px;
    white-space: nowrap;
  }
  .counts a b {
    font: 600 15px var(--font-head);
    color: var(--head);
  }
  .counts a:hover {
    border-color: var(--link);
    color: var(--link);
  }
</style>
