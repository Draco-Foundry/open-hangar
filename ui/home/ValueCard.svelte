<script>
  // Account Value: everything you own (OH.accountValue: ships at store price, CCUs at
  // standard price, everything else at melt value, plus Store Credit), what it's made
  // of, how it compares with melt value (not "what you paid", which RSI can't know
  // for gifted or grey-market pledges), and clickable counts that open Inventory
  // filtered. The value trend lives on Stats → History (owner: no chart on Home).
  import { app, OH, version } from '../lib/app.svelte.js';
  import { exactCount, plural, shortCount } from '../lib/format.js';

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
  /* Pinned to the bottom, so the card's footer lines up with its row. */
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
