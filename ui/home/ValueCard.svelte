<script>
  // Account Value: today's value, two small stats (trend since the first scan, and
  // vs melt value: not "what you paid", which RSI can't know for gifted or
  // grey-market pledges), clickable counts that open Inventory filtered, and what
  // changed since the last scan. No chart here; Stats → History has it.
  import { app, OH, version } from '../lib/app.svelte.js';
  import { exactCount, monthName, plural, shortCount } from '../lib/format.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const items = s.items;
    const v = a.hangarValue();
    const melt = OH().totalValue(items);
    const hist = s.history || [];
    let since = null;
    if (hist.length >= 2) {
      const first = a.snapshotStore(hist[0]);
      const last = a.snapshotStore(hist[hist.length - 1]);
      if (first != null && last != null) since = { delta: last - first, from: hist[0].at };
    }
    let changes = '';
    if (hist.length >= 2) {
      const diff = OH().diffSnapshots(hist[hist.length - 2], hist[hist.length - 1]);
      changes = `Since ${a.fmtDay(hist[hist.length - 2].at)}: ${a.changeSummary(diff)}`;
    }
    return {
      scannedAt: s.scannedAt || null,
      store: v && v.store ? v.store : null,
      melt,
      vsPaid: v && v.paidPriced ? v.storePriced - v.paidPriced : null,
      since,
      fresh: hist.length < 2,
      changes,
      counts: [
        { key: 'ship', n: items.filter((p) => p.containsShip).length, one: 'ship', many: 'ships' },
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

<section class="oh-p oh-wide value">
  <div class="top">
    <div class="oh-lbl">{d.store != null ? 'Account Value' : 'Melt Value'}</div>
    {#if upd}
      <div class="upd" class:stale={upd.stale} title="Last scan: {upd.full}">
        {upd.text}{#if upd.stale}
          · <a href="#home" onclick={rescan}>Rescan?</a>{/if}
      </div>
    {/if}
  </div>
  {#if d.store != null}
    <div class="big" title={a.dollars(d.store)}>{a.bigMoney(d.store)}</div>
  {:else}
    <div class="big" title={a.money(d.melt)}>{a.bigMoney(d.melt)}</div>
  {/if}
  <div class="pills">
    {#if d.since}
      <span class="pill" class:down={d.since.delta < 0} title={exact(d.since.delta)}
        >{signed(d.since.delta)} since {monthName(d.since.from)}</span
      >
    {/if}
    {#if d.vsPaid != null}
      <span class="pill" class:down={d.vsPaid < 0} title={exact(d.vsPaid)}
        >{signed(d.vsPaid)} vs melt value</span
      >
    {/if}
    {#if d.fresh}
      <span class="pill info">Your value trend shows after your next scan</span>
    {/if}
  </div>
  <div class="counts">
    {#each d.counts as c (c.key)}
      <a href={c.key === 'buybacks' ? '#buybacks' : '#inventory'} title="{exactCount(c.n)} {plural(c.n, c.one, c.many)}" onclick={(e) => open(c, e)}
        ><b>{shortCount(c.n)}</b> {plural(c.n, c.one, c.many)}</a
      >
    {/each}
  </div>
  {#if d.changes}
    <div class="chg">{d.changes} · <a href="#stats" data-stats-tab="history">History</a></div>
  {/if}
</section>

<style>
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
    font-weight: 700;
  }
  .big {
    font: 800 46px/1.05 var(--font-head);
    color: var(--head);
    letter-spacing: -0.02em;
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .pills:empty {
    display: none;
  }
  .pill {
    font: 700 13px var(--font-head);
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
  .pill.info {
    background: var(--panel-2);
    color: var(--muted);
    font-weight: 600;
    white-space: normal;
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin-top: 16px;
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
    font: 800 15px var(--font-head);
    color: var(--head);
  }
  .counts a:hover {
    border-color: var(--link);
    color: var(--link);
  }
  .chg {
    font-size: 13px;
    color: var(--muted);
    margin-top: 12px;
  }
</style>
