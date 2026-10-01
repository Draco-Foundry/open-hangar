<script>
  // Account Value: everything you own (OH.accountValue: ships at store price, CCUs at
  // standard price, everything else at melt value, plus Store Credit), what it's made
  // of, two small stats (trend since the first scan, and
  // vs melt value: not "what you paid", which RSI can't know for gifted or
  // grey-market pledges), clickable counts that open Inventory filtered, and what
  // changed since the last scan. At the bottom, a small chart of the account's value
  // at each scan (today's store prices), pinned down so the card lines up with the
  // card beside it; Stats → History has the full one.
  import { app, OH, version } from '../lib/app.svelte.js';
  import { exactCount, monthName, plural, shortCount } from '../lib/format.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const items = s.items;
    const v = a.hangarValue();
    const acct = a.accountValue();
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
    // One point per scan, oldest first (same numbers as Stats → History).
    const trend = hist
      .map((h) => ({ at: h.at, v: a.snapshotStore(h), note: a.creditNote(h) }))
      .filter((p) => p.v != null && Number.isFinite(p.at));
    return {
      trend: trend.length >= 2 ? trend : null,
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
  // The chart, scaled to its own box: an area and a line, the top and bottom values on
  // the left, the first scan's date and "Today" underneath.
  const W = 400;
  const H = 120;
  const chart = $derived.by(() => {
    const t = d.trend;
    if (!t) return null;
    const vs = t.map((p) => p.v);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    if (hi - lo < 1) {
      hi += 1;
      lo -= 1;
    }
    const pad = (hi - lo) * 0.12;
    lo = Math.max(0, lo - pad);
    hi += pad;
    const t0 = t[0].at;
    const span = Math.max(1, t[t.length - 1].at - t0);
    const x = (at) => ((at - t0) / span) * W;
    const y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);
    const pts = t.map((p) => ({ ...p, x: x(p.at), y: y(p.v) }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return {
      pts,
      line,
      area: `${line} L${W} ${H} L0 ${H} Z`,
      hi: a.bigMoney(Math.max(...vs)),
      lo: a.bigMoney(Math.min(...vs)),
      from: a.fmtDay(t0),
      up: t[t.length - 1].v >= t[0].v,
    };
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
  {#if d.store != null && d.parts.length > 1}
    <div class="parts" title="Ships at today's store price, CCUs at standard price, everything else at melt value, plus Store Credit. Buy-backs, UEC and REC aren't counted.">
      {#each d.parts as [label, n], i (label)}{#if i}<span class="sep">·</span>{/if}<span>{label} <b>{a.bigMoney(n)}</b></span>{/each}
    </div>
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
  {#if chart}
    <div class="trend" class:down={!chart.up}>
      <div class="tr-head"><span>Since Your First Scan</span><span class="tr-range">{chart.lo} to {chart.hi}</span></div>
      <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Account value from {chart.from} to today">
        <defs>
          <linearGradient id="oh-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.3" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d={chart.area} fill="url(#oh-trend-fill)" />
        <path d={chart.line} fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        {#each chart.pts as p (p.at)}
          <circle cx={p.x} cy={p.y} r="9" fill="transparent"><title>{a.fmtDay(p.at)}: {a.bigMoney(p.v)}{p.note}</title></circle>
        {/each}
      </svg>
      <div class="tr-foot"><span>{chart.from}</span><span>Today</span></div>
    </div>
  {/if}
</section>

<style>
  .value {
    display: flex;
    flex-direction: column;
  }
  .trend {
    margin-top: auto;
    padding-top: 18px;
    color: var(--good);
  }
  .trend.down {
    color: var(--bad);
  }
  .trend svg {
    display: block;
    width: 100%;
    height: 110px;
    overflow: visible;
  }
  .tr-head,
  .tr-foot {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
  }
  .tr-head {
    margin-bottom: 8px;
    font: 700 11px var(--font-head);
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .tr-range {
    letter-spacing: 0;
    text-transform: none;
    font: 600 12px var(--font-body);
  }
  .tr-foot {
    margin-top: 6px;
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
    font-weight: 700;
  }
  .parts .sep {
    opacity: 0.6;
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
