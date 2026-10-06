<script>
  // Account Value: everything you own (OH.accountValue: ships at store price, CCUs at
  // standard price, everything else at melt value, plus Store Credit), what it's made
  // of, how it compares with melt value (not "what you paid", which RSI can't know
  // for gifted or grey-market pledges), and clickable counts that open Inventory
  // filtered. The value trend lives on Stats → History (owner: no chart on Home).
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
    const acct = a.accountValue();
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
            ['Store Credit', acct.credit],
          ].filter(([, n]) => n >= 0.5)
        : [],
      melt,
      // Most Valuable: the top ship pledges at today's store price (the numbers
      // behind "Ships $X"; owner picked this to fill the card, 2026-10-06).
      top: mostValuable(items, v, TOP_N).map((r) => ({
        ...r,
        name: a.cardName(r.p),
        full: a.plainName(r.p),
        ins: insChip(r.p.insurance),
        img: a.realImage(r.p.image),
        resolve: a.resolveImageName(r.p),
      })),
      vsPaid: v && v.paidPriced ? v.storePriced - v.paidPriced : null,
      counts: [
        { key: 'ship', n: items.filter((p) => p.containsShip).length, one: 'ship pledge', many: 'ship pledges' },
        { key: 'all', n: items.length, one: 'pledge', many: 'pledges' },
        { key: 'ccu', n: items.filter((p) => p.kind === 'ccu').length, one: 'CCU', many: 'CCUs' },
        { key: 'lti', n: items.filter((p) => p.insurance === 'LTI').length, one: 'LTI', many: 'LTI' },
        { key: 'buybacks', n: s.buybacks.length, one: 'buy-back', many: 'buy-backs' },
      ].filter((c) => c.n > 0),
    };
  });
  const a = app();
  const signed = (n) => (n >= 0 ? '+' : '−') + a.bigMoney(Math.abs(n));
  const exact = (n) => (n < 0 ? '−' : '') + a.dollars(Math.abs(n));

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
    <div class="oh-lbl">{d.store != null ? 'Account Value' : 'Melt Value'}</div>
    {#if upd}
      <div class="upd" class:stale={upd.stale} title="Last scan: {upd.full}">
        {upd.text}{#if upd.stale}
          · <a href="#home" onclick={rescan}>Rescan?</a>{/if}
      </div>
    {/if}
  </div>
  <!-- The number with the vs-melt pill beside it (owner picked Option A, #166); the
       pill wraps under the number when the card is narrow. -->
  <div class="headline">
    {#if d.store != null}
      <div class="big" title={a.dollars(d.store)}>{a.bigMoney(d.store)}</div>
    {:else}
      <div class="big" title={a.money(d.melt)}>{a.bigMoney(d.melt)}</div>
    {/if}
    <div class="pills">
      {#if d.vsPaid != null}
        <span class="pill" class:down={d.vsPaid < 0} title={exact(d.vsPaid)}
          >{signed(d.vsPaid)} vs melt value</span
        >
      {/if}
    </div>
  </div>
  {#if d.store != null && d.parts.length > 1}
    <div class="parts" title="Ships at today's store price, CCUs at standard price, everything else at melt value, plus Store Credit. Buy-backs, UEC and REC aren't counted.">
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
            <b title={"Today's store price: " + a.dollars(r.store)}>{a.bigMoney(r.store)}</b>
            {#if r.gain != null && Math.abs(r.gain) >= 1}
              <span class="gain" class:down={r.gain < 0} title="Melt value: {a.dollars(r.paid)}"
                >{#if r.gain >= 0}{signed(r.gain)} over what you paid{:else}{signed(r.gain)}{/if}</span
              >
            {/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}
  <div class="counts">
    {#each d.counts as c (c.key)}
      <a href={c.key === 'buybacks' ? '#buybacks' : '#inventory'} title="{exactCount(c.n)} {plural(c.n, c.one, c.many)}" onclick={(e) => open(c, e)}
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
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pills:empty {
    display: none;
  }
  .pill {
    font: 600 13px var(--font-head);
    border-radius: 999px;
    padding: 5px 12px;
    background: var(--good-soft);
    color: var(--good);
    white-space: nowrap;
  }
  .pill.down {
    background: var(--bad-soft);
    color: var(--bad);
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
  .gain {
    color: var(--good);
  }
  .gain.down {
    color: var(--muted);
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
