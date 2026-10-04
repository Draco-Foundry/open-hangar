<script>
  // Referrals: progress to the next reward, everything earned, stats, trends,
  // milestones, both reward ladders, bonus events and the recruit / prospect list.
  // Ported as it looked in dashboard.js (renderReferrals); the classes and styles
  // are the classic ones (referrals.css).
  import { untrack } from 'svelte';
  import { app, OH, version } from '../lib/app.svelte.js';

  const a = app();
  const DAY = 86400000;
  const nf = (n) => n.toLocaleString('en-US');
  const s = (n) => (n === 1 ? '' : 's');
  const dayLong = (t) =>
    new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const shipName = (it) => it.img || it.n.replace(/\s*\(LTI\)/i, '').trim();
  const shipHref = (it) =>
    `https://robertsspaceindustries.com/ship-matrix/search?q=${encodeURIComponent(shipName(it))}`;
  const wikiHref = (it) => `https://starcitizen.tools/index.php?search=${encodeURIComponent(it.n)}`;

  // The list under People: which tab, the search and the sort. Kept while the page stays open.
  let tab = $state('recruits');
  let query = $state('');
  let sort = $state('newest');
  let copied = $state(false);

  // Pictures: wiki files (tier and event art) and ship art, looked up after render.
  let fileUrl = $state({});
  let shipUrl = $state({});
  let broken = $state({});

  function stats(ref) {
    const recruitsRows = ref.recruitsList || [];
    const recruits = ref.legacy?.recruits ?? 0; // all-time recruit total
    const prospects = ref.prospects ?? 0;
    const prospectsList = ref.prospectsList || [];
    const dates = recruitsRows.map(a.recruitDate).filter(Boolean);
    const best = a.bestMonth(dates);
    const now = new Date();
    // Conversions in a window of days ago, and the trend vs the prior 30.
    const inWindow = (from, to = 0) =>
      dates.filter((d) => {
        const age = (now - d) / DAY;
        return age >= to && age < from;
      }).length;
    const last30 = inWindow(30);
    const prev30 = inWindow(60, 30);
    const last90 = inWindow(90);
    let trend = '';
    if (prev30 > 0) {
      const pct = Math.round(((last30 - prev30) / prev30) * 100);
      trend = pct === 0 ? '→ flat' : pct > 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
    } else if (last30 > 0) {
      trend = '↑ new';
    }
    // Recent pace (recruits per month over 90 days) to the next standard tier.
    const pace90 = last90 / 3;
    const nextTier = a.referralLadders.standard.find((t) => recruits < t.at) || null;
    let projection = '—';
    if (nextTier && pace90 > 0) {
      const months = (nextTier.at - recruits) / pace90;
      projection =
        months < 1 ? '< 1 mo' : months < 18 ? `${Math.round(months)} mo` : `${(months / 12).toFixed(1)} yr`;
    }
    return {
      recruits,
      prospects,
      total: prospects + recruits, // everyone who used your code
      conv: prospects > 0 ? `${((recruits / prospects) * 100).toFixed(1)}%` : '—',
      last30,
      last90,
      trend,
      latest: dates.length ? dayLong(Math.max(...dates)) : '—',
      first: dates.length ? dayLong(Math.min(...dates)) : '—',
      pending: prospectsList.length,
      best,
      nextTier,
      projection,
    };
  }

  // Top of the page: recruits, rank, the bar to the next reward, both tracks.
  function hero(ref, st, hasLegacy) {
    const { recruits } = st;
    const p = a.tierProgress(recruits);
    const running = a.runningEvent();
    const track = (ladder, label) => {
      const next = ladder.find((t) => recruits < t.at) || null;
      return {
        label,
        steps: ladder.map((t) => ({
          cls: recruits >= t.at ? 'on' : next && t.at === next.at ? 'next' : '',
          tip: `${nf(t.at)} recruit${s(t.at)}${t.rank ? ` · ${t.rank}` : ''}: ${a.rewardNames(t.items)}`,
          at: t.at,
          file: t.file || '',
        })),
      };
    };
    return {
      recruits,
      rank: hasLegacy ? a.legacyRank(recruits) : '',
      next: p.next
        ? { more: nf(p.next.at - recruits), what: a.rewardNames(p.next.items) }
        : null,
      pace: st.nextTier && st.projection !== '—' ? st.projection : '',
      pct: (p.pct * 100).toFixed(1),
      from: nf(p.from),
      to: p.next ? nf(p.next.at) : '',
      running: running
        ? { name: running.name, until: a.fmtDate(a.parseTs(running.end + ' 00:00:00')) }
        : null,
      tracks: [
        track(a.referralLadders.standard, 'Standard Ladder'),
        ...(hasLegacy ? [track(a.referralLadders.legacy, 'Legacy Ladder')] : []),
      ],
    };
  }

  // Cumulative recruits (area + line) over per-month bars, as one SVG.
  function overTime(rows) {
    const dated = rows
      .map(a.recruitDate)
      .filter(Boolean)
      .sort((x, y) => x - y);
    if (dated.length < 2) return null;
    const counts = new Map();
    for (const d of dated) counts.set(a.monthKey(d), (counts.get(a.monthKey(d)) || 0) + 1);
    // Fill gaps between the first and last month so the x-axis is continuous.
    const months = [];
    const last = dated[dated.length - 1];
    const end = new Date(last.getFullYear(), last.getMonth(), 1);
    for (let d = new Date(dated[0].getFullYear(), dated[0].getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1))
      months.push({ key: a.monthKey(d), n: counts.get(a.monthKey(d)) || 0 });
    let cum = 0;
    const series = months.map((m) => ({ ...m, cum: (cum += m.n) }));
    const W = 560,
      H = 180,
      padL = 34,
      padR = 8,
      padB = 22,
      padT = 8;
    const iw = W - padL - padR,
      ih = H - padT - padB;
    const maxCum = series[series.length - 1].cum || 1;
    const maxBar = Math.max(1, ...series.map((m) => m.n));
    const x = (i) => padL + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
    const yCum = (v) => padT + ih - (v / maxCum) * ih;
    const line = series.map((m, i) => `${x(i).toFixed(1)},${yCum(m.cum).toFixed(1)}`).join(' ');
    const barW = Math.max(2, (iw / series.length) * 0.5);
    return {
      W,
      H,
      padL,
      base: padT + ih,
      right: padL + iw,
      line,
      area: `${padL},${padT + ih} ${line} ${(padL + iw).toFixed(1)},${(padT + ih).toFixed(1)}`,
      bars: series.map((m, i) => {
        const h = (m.n / maxBar) * ih;
        return {
          x: (x(i) - barW / 2).toFixed(1),
          y: (padT + ih - h).toFixed(1),
          w: barW.toFixed(1),
          h: h.toFixed(1),
        };
      }),
      maxCum,
      maxY: yCum(maxCum) + 3,
      // X labels: first, middle, last month.
      labels: [...new Set([0, Math.floor(series.length / 2), series.length - 1])].map((i) => ({
        x: x(i).toFixed(1),
        key: series[i].key,
      })),
    };
  }

  // New recruits per calendar year (by conversion date).
  function byYear(rows) {
    const m = new Map();
    for (const r of rows) {
      const d = a.recruitDate(r);
      if (d) m.set(d.getFullYear(), (m.get(d.getFullYear()) || 0) + 1);
    }
    const max = Math.max(0, ...m.values());
    return [...m.keys()]
      .sort((x, y) => x - y)
      .map((y) => ({ y, n: m.get(y), pct: Math.round((m.get(y) / max) * 100) }));
  }

  // How long prospects have been waiting, and how fast recruits converted.
  function prospectInsights(ref) {
    const now = Date.now();
    const buckets = [
      ['Under 30 days', 30],
      ['1 to 3 months', 91],
      ['3 to 12 months', 365],
      ['1 to 2 years', 730],
      ['Over 2 years', Infinity],
    ].map(([label, max]) => ({ label, max, n: 0 }));
    for (const p of ref.prospectsList || []) {
      const d = a.parseTs(p.enlistedOn);
      if (!d) continue;
      const age = (now - d) / DAY;
      buckets.find((b) => age < b.max).n++;
    }
    const maxN = Math.max(1, ...buckets.map((b) => b.n));
    for (const b of buckets) b.pct = Math.round((b.n / maxN) * 100);
    const waits = (ref.recruitsList || [])
      .map((r) => {
        const x = a.parseTs(r.enlistedOn);
        const y = a.parseTs(r.convertedOn);
        return x && y && y >= x ? (y - x) / DAY : null;
      })
      .filter((w) => w != null)
      .sort((x, y) => x - y);
    let speed = null;
    if (waits.length) {
      const median = waits[Math.floor(waits.length / 2)];
      const within = (days) => Math.round((waits.filter((w) => w <= days).length / waits.length) * 100);
      const days = (n) => (n < 1 ? 'same day' : `${Math.round(n)} day${s(Math.round(n))}`);
      speed = { median: days(median), sameDay: within(1), month: within(30), overYear: 100 - within(365) };
    }
    return { buckets, speed };
  }

  // When each tier was reached: the Nth recruit's conversion date. If RSI's list
  // is shorter than the total (very old recruits), early tiers have no date.
  function milestones(recruits, rows, hasLegacy) {
    const dates = rows
      .map(a.recruitDate)
      .filter(Boolean)
      .sort((x, y) => x - y);
    const offset = recruits - dates.length; // recruits we have no date for
    const byAt = new Map();
    const L = a.referralLadders;
    for (const t of [...L.standard, ...(hasLegacy ? L.legacy : [])].filter((t) => recruits >= t.at)) {
      const cur = byAt.get(t.at) || { at: t.at, items: [], rank: '' };
      cur.items.push(...t.items);
      if (t.rank) cur.rank = t.rank;
      byAt.set(t.at, cur);
    }
    return [...byAt.values()]
      .sort((x, y) => y.at - x.at)
      .map((m) => {
        const d = dates[m.at - 1 - offset];
        return { ...m, date: d ? a.fmtDate(d) : 'before your recruit list starts', what: a.rewardNames(m.items) };
      });
  }

  // One reward ladder (standard or legacy): each tier unlocked, next (with the gap) or locked.
  function ladder(list, recruits, title, note) {
    const next = list.find((t) => recruits < t.at) || null;
    return {
      title,
      note,
      unlocked: list.filter((t) => recruits >= t.at).length,
      size: list.length,
      next: next ? { items: next.items, at: nf(next.at), more: nf(next.at - recruits) } : null,
      rows: list.map((t) => {
        const isNext = next && t.at === next.at;
        return {
          cls: recruits >= t.at ? 'reward-unlocked' : isNext ? 'reward-next' : 'reward-locked',
          mark: recruits >= t.at ? '✓' : isNext ? '◷' : '○',
          at: nf(t.at),
          rank: t.rank || '',
          items: t.items || [],
          togo: isNext ? nf(t.at - recruits) : '',
        };
      }),
    };
  }

  // Event bonuses earned: once per event, dated by the first recruit who converted in it.
  function eventRewards(rows) {
    const hits = new Map();
    for (const r of rows) {
      const d = a.recruitDate(r);
      const ev = a.eventForDate(d);
      if (!ev) continue;
      const cur = hits.get(ev.name);
      if (!cur) hits.set(ev.name, { ev, firstDate: d });
      else if (d < cur.firstDate) cur.firstDate = d;
    }
    return [...hits.values()]
      .sort((x, y) => a.parseTs(y.ev.start) - a.parseTs(x.ev.start))
      .map(({ ev, firstDate }) => ({ name: ev.name, reward: ev.reward, date: dayLong(firstDate) }));
  }

  function eventBanner() {
    const running = a.runningEvent();
    if (running)
      return {
        live: true,
        name: running.name,
        until: a.fmtDate(a.parseTs(running.end + ' 00:00:00')),
        reward: running.reward,
      };
    const past = a.referralEvents.filter((e) => a.parseTs(e.end + ' 23:59:59') < new Date());
    const last = past[past.length - 1];
    return last
      ? { live: false, name: last.name, start: a.fmtDate(a.parseTs(last.start + ' 00:00:00')), reward: last.reward }
      : null;
  }

  const page = $derived.by(() => {
    version.n;
    const ref = a.state.referral;
    if (!ref) return null;
    const rows = ref.recruitsList || [];
    const st = stats(ref);
    const hasLegacy = st.recruits > 0; // a legacy recruit count means legacy ladder access
    const L = a.referralLadders;
    return {
      ref,
      st,
      hasLegacy,
      hero: hero(ref, st, hasLegacy),
      gallery: a.earnedRewards(st.recruits, rows, hasLegacy),
      chart: overTime(rows),
      convPct: st.prospects > 0 ? (st.recruits / st.prospects) * 100 : 0,
      years: byYear(rows),
      prospects: prospectInsights(ref),
      milestones: milestones(st.recruits, rows, hasLegacy),
      ladders: [
        ladder(L.standard, st.recruits, 'Standard Ladder', 'Always-on rewards; tiers by total recruits.'),
        ...(hasLegacy
          ? [
              ladder(
                L.legacy,
                st.recruits,
                'Legacy Ladder',
                'Pre-July 2025 ladder. You keep access, and new recruits still count toward it.',
              ),
            ]
          : []),
      ],
      banner: eventBanner(),
      events: eventRewards(rows),
    };
  });

  // The People list: the active tab, with search and sort applied.
  const people = $derived.by(() => {
    if (!page) return null;
    const ref = page.ref;
    const full = (tab === 'prospects' ? ref.prospectsList : ref.recruitsList) || [];
    let list = full;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => `${r.handle || ''} ${r.moniker || ''}`.toLowerCase().includes(q));
    // Sort by the date shown in this tab: recruits by conversion, prospects by enlist.
    const ts = (r) => {
      const d = tab === 'recruits' ? a.recruitDate(r) : a.parseTs(r.enlistedOn);
      return d ? d.getTime() : 0;
    };
    const byName = (x, y) => (x.handle || x.moniker || '').localeCompare(y.handle || y.moniker || '');
    list = list
      .slice()
      .sort((x, y) => (sort === 'oldest' ? ts(x) - ts(y) : sort === 'name' ? byName(x, y) : ts(y) - ts(x)));
    return {
      total: full.length,
      rows: list.map((r) => {
        // Recruits show their conversion date (when they counted), with a ★ when it
        // fell in a bonus event; prospects show when they enlisted.
        const d = tab === 'recruits' ? a.recruitDate(r) : a.parseTs(r.enlistedOn);
        const ev = tab === 'recruits' && d ? a.eventForDate(d) : null;
        return {
          handle: r.handle || r.moniker || '—',
          url: r.handle ? `https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(r.handle)}` : null,
          moniker: r.moniker || '',
          legacy: tab === 'recruits' && r.campaign === 'legacy',
          when: d ? d.toLocaleDateString() : '—',
          ev: ev ? `${ev.name}: ${ev.reward}` : '',
        };
      }),
    };
  });

  // Pictures for the ladder dots, gallery cards and ship reward links (hover preview).
  const asked = new Set();
  function shipArt(names) {
    const todo = names.filter((n) => n && !asked.has('ship:' + n));
    todo.forEach((n) => asked.add('ship:' + n));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const n = todo[i++];
        const url = await OH().getShipImage(n);
        if (url) shipUrl[n] = url;
      }
    };
    for (let w = 0; w < 3; w++) worker();
  }
  $effect(() => {
    if (!page) return;
    const files = [
      ...page.hero.tracks.flatMap((t) => t.steps.map((x) => x.file)),
      ...page.gallery.map((g) => g.file),
    ].filter((f) => f && !asked.has('file:' + f));
    const gallery = page.gallery;
    const rewardShips = page.ladders.flatMap((l) => l.rows.flatMap((r) => r.items.filter((it) => it.ship).map(shipName)));
    shipArt(rewardShips);
    const done = () => shipArt(gallery.filter((g) => g.resolve && !(g.file && fileUrl[g.file])).map((g) => g.resolve));
    if (!files.length) return void untrack(done);
    files.forEach((f) => asked.add('file:' + f));
    Promise.resolve(OH().wikiImageUrls(files)).then((urls) => {
      for (const f of files) if (urls && urls[f]) fileUrl[f] = urls[f];
      done();
    });
  });
  const galleryImg = (g) => {
    const url = (g.file && fileUrl[g.file]) || (g.resolve && shipUrl[g.resolve]) || '';
    return broken[url] ? '' : url;
  };

  function pickTab(key) {
    if (tab === key) return;
    tab = key;
    query = '';
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(page.ref.url || page.ref.code || '');
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* clipboard blocked: no-op */
    }
  }
</script>

{#snippet rewardItems(items)}
  {#each items as it, i}{#if i}<span class="reward-sep">{' · '}</span>{/if}{#if it.ship}<a
        class="reward-item ship"
        href={shipHref(it)}
        target="_blank"
        rel="noopener"
        data-resolve={shipName(it)}
        data-image={shipUrl[shipName(it)] || undefined}>{it.n}</a
      >{:else}<a class="reward-item" href={wikiHref(it)} target="_blank" rel="noopener">{it.n}</a>{/if}{/each}
{/snippet}

{#if !page}
  <div class="placeholder-view">
    <p class="muted">
      No recruits on the roster yet. Your wingmen are out there somewhere. Hit
      <strong>Scan</strong> at the top to pull your recruits and prospects from your
      <a href="https://robertsspaceindustries.com/en/referral" target="_blank" rel="noopener">RSI Referral Rewards</a> page.
    </p>
  </div>
{:else}
  {@const st = page.st}
  {@const h = page.hero}
  {#if page.ref.code}
    <div class="ref-code-banner">
      Your referral code:
      <span class="ref-code">{page.ref.code}</span>
      <button class="ref-copy" class:copied title="Copy referral link" onclick={copy}>{copied ? 'Copied' : 'Copy Link'}</button>
    </div>
  {/if}

  <div class="ref-hero">
    <div class="ref-hero-top">
      <div>
        <div class="ref-hero-n">{nf(h.recruits)}<span>{' '}recruit{s(h.recruits)}</span></div>
        {#if h.rank}<div class="ref-hero-rank">{h.rank}</div>{/if}
      </div>
      <div class="ref-share">
        <label class="mk-toggle" title="Adds your referral code and a QR code people can scan"
          ><input type="checkbox" id="ref-share-code" /> Include My Code</label
        >
        <button type="button" class="mk-btn" id="ref-share" onclick={() => a.shareReferralImage()}>Download Image</button>
        <span class="mk-export-status" id="ref-share-status" aria-live="polite"></span>
      </div>
    </div>
    <div class="ref-hero-next">
      {#if h.next}
        <strong>{h.next.more} more</strong> to {h.next.what}{#if h.pace}{' '}<span class="muted">· at your pace {h.pace}</span>{/if}
      {:else}
        Every standard reward unlocked
      {/if}
    </div>
    <div class="ref-hero-bar"><div style="width:{h.pct}%"></div></div>
    <div class="ref-hero-bar-ends"><span>{h.from}</span><span>{h.to}</span></div>
    {#if h.running}
      <div class="ref-hero-event">Bonus event on now: <strong>{h.running.name}</strong>, until {h.running.until}</div>
    {/if}
    {#each h.tracks as t (t.label)}
      <div class="rt">
        <div class="rt-label">{t.label}</div>
        <div class="rt-track">
          {#each t.steps as x (x.at)}
            <div
              class="rt-step {x.cls}"
              data-tip={x.tip}
              aria-label={x.tip}
              data-file={x.file || undefined}
              data-image={(x.file && fileUrl[x.file]) || undefined}
            >
              <span class="rt-dot"></span><span class="rt-at">{nf(x.at)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <h3 class="section-title" style="margin-top:26px">Rewards Earned</h3>
  {#if page.gallery.length}
    <div class="ref-gallery">
      {#each page.gallery as g, i (i + ':' + g.name + g.sub)}
        {@const img = galleryImg(g)}
        <div class="ref-gcard" data-file={g.file || undefined} data-resolve={g.resolve || undefined} data-image={img || undefined}>
          <div class="ref-gimg">
            {#if img}<img alt="" loading="lazy" src={img} onerror={() => (broken[img] = true)} />{/if}
          </div>
          <div class="ref-gname" title={g.name}>{g.name}</div>
          <div class="ref-gsub">{g.sub}</div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="muted">No rewards yet. Your first recruit unlocks the GCD-Army armor. Go recruit a wingman.</p>
  {/if}

  <div class="stat-group-label" style="margin-top:22px">Overview</div>
  <div class="stat-grid ref-totals">
    <div class="stat-box span2"><div class="big">{nf(st.total)}</div><div class="lbl">total (prospects + recruits)</div></div>
    <div class="stat-box"><div class="big">{nf(st.recruits)}</div><div class="lbl">recruits</div></div>
    <div class="stat-box"><div class="big">{nf(st.prospects)}</div><div class="lbl">prospects</div></div>
    <div class="stat-box"><div class="big">{st.conv}</div><div class="lbl">conversion</div></div>
  </div>

  <div class="stat-group-label">Recent Activity</div>
  <div class="stat-grid">
    <div class="stat-box"><div class="big">{nf(st.last30)}</div><div class="lbl">recruits · last 30d</div></div>
    <div class="stat-box"><div class="big">{st.trend || '—'}</div><div class="lbl">vs prior 30d</div></div>
    <div class="stat-box"><div class="big">{nf(st.last90)}</div><div class="lbl">recruits · last 90d</div></div>
    <div class="stat-box"><div class="big">{st.latest}</div><div class="lbl">latest conversion</div></div>
  </div>

  <div class="stat-group-label">Pipeline &amp; Progress</div>
  <div class="stat-grid">
    <div class="stat-box"><div class="big">{nf(st.pending)}</div><div class="lbl">pending prospects</div></div>
    <div class="stat-box">
      <div class="big">{st.best ? `${st.best.n}` : '—'}</div>
      <div class="lbl">{st.best ? `best month (${st.best.label})` : 'best month'}</div>
    </div>
    <div class="stat-box"><div class="big">{st.first}</div><div class="lbl">first conversion</div></div>
    <div class="stat-box">
      <div class="big">{st.nextTier ? st.projection : '—'}</div>
      <div class="lbl">{st.nextTier ? `est. to ${nf(st.nextTier.at)} tier` : 'all tiers done'}</div>
    </div>
  </div>

  <h3 class="section-title" style="margin-top:26px">Trends</h3>
  <div class="ref-charts">
    <div class="ref-chart">
      <h4>Recruits Over Time (Cumulative · Monthly)</h4>
      {#if page.chart}
        {@const c = page.chart}
        <svg viewBox="0 0 {c.W} {c.H}" role="img" aria-label="Recruits over time">
          <line class="axis" x1={c.padL} y1={c.base} x2={c.right} y2={c.base}></line>
          {#each c.bars as b, i (i)}<rect class="bar" x={b.x} y={b.y} width={b.w} height={b.h} opacity="0.35"></rect>{/each}
          <polygon class="area" points={c.area}></polygon>
          <polyline class="line" points={c.line}></polyline>
          <text class="tick" x={c.padL - 6} y={c.maxY} text-anchor="end">{c.maxCum}</text>
          <text class="tick" x={c.padL - 6} y={c.base} text-anchor="end">0</text>
          {#each c.labels as l (l.x)}<text class="tick" x={l.x} y={c.H - 6} text-anchor="middle">{l.key}</text>{/each}
        </svg>
      {:else}
        <p class="muted">Not enough dated recruits to chart yet. Recruit a few more and this lights up.</p>
      {/if}
    </div>
    <div class="ref-chart">
      <h4>Prospect → Recruit Conversion</h4>
      <div class="ref-conv-rate" style="font-size:26px;font-weight:600;margin-bottom:8px">{page.convPct.toFixed(1)}%</div>
      <div class="ref-conv-bar">
        <div class="seg-conv" style="width:{page.convPct.toFixed(2)}%"></div>
        <div class="seg-rest" style="width:{Math.max(0, 100 - page.convPct).toFixed(2)}%"></div>
      </div>
      <div class="ref-conv-legend">
        <span><span class="dot" style="background:var(--good)"></span>{nf(st.recruits)} recruits</span>
        <span><span class="dot" style="background:rgba(255,255,255,0.1)"></span>{nf(st.prospects - st.recruits)} prospects</span>
      </div>
    </div>
  </div>
  <div class="stat-group-label">Recruits by Year</div>
  {#each page.years as y (y.y)}
    <div class="bar-row">
      <div class="bar-label">{y.y}</div>
      <div class="bar-track"><div class="bar-fill" style="width:{y.pct}%"></div></div>
      <div class="bar-val">{y.n}</div>
    </div>
  {:else}
    <p class="muted">No dated recruits yet.</p>
  {/each}

  <h3 class="section-title" style="margin-top:26px">Prospects</h3>
  <div class="ref-charts">
    <div class="ref-chart">
      <h4>Waiting Prospects by Age</h4>
      {#each page.prospects.buckets as b (b.label)}
        <div class="bar-row">
          <div class="bar-label">{b.label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:{b.pct}%"></div></div>
          <div class="bar-val">{nf(b.n)}</div>
        </div>
      {/each}
      <p class="muted ref-small">
        People who signed up with your code but haven't bought a game package yet. Still in the lobby. RSI doesn't
        share a way to contact them.
      </p>
    </div>
    <div class="ref-chart">
      <h4>How Fast Recruits Bought</h4>
      {#if page.prospects.speed}
        {@const sp = page.prospects.speed}
        <div class="stat-grid">
          <div class="stat-box"><div class="big">{sp.median}</div><div class="lbl">typical time to convert</div></div>
          <div class="stat-box"><div class="big">{sp.sameDay}%</div><div class="lbl">bought the same day</div></div>
          <div class="stat-box"><div class="big">{sp.month}%</div><div class="lbl">within 30 days</div></div>
          <div class="stat-box"><div class="big">{sp.overYear}%</div><div class="lbl">took over a year</div></div>
        </div>
      {:else}
        <p class="muted">No recruits with both dates yet. Still waiting on comms.</p>
      {/if}
    </div>
  </div>

  <h3 class="section-title" style="margin-top:26px">Milestones</h3>
  {#if page.milestones.length}
    <ol class="ref-timeline">
      {#each page.milestones as m (m.at)}
        <li>
          <span class="rtl-dot"></span>
          <div class="rtl-head">
            <strong>{nf(m.at)} recruit{s(m.at)}</strong>{#if m.rank}{' '}<span class="reward-rank">{m.rank}</span>{/if}<span class="rtl-date">{m.date}</span>
          </div>
          <div class="rtl-items muted">{m.what}</div>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted">Your first milestone is 1 recruit. Every fleet starts with a wingman.</p>
  {/if}

  <h3 class="section-title" style="margin-top:26px">Tier Rewards</h3>
  <div class="reward-ladders" class:two={page.ladders.length > 1}>
    {#each page.ladders as l (l.title)}
      <div class="reward-ladder">
        <h4>{l.title} <span class="reward-progress">{l.unlocked}/{l.size} unlocked</span></h4>
        <p class="muted reward-note">{l.note}</p>
        <p class="muted reward-next-line">
          {#if l.next}Next: {@render rewardItems(l.next.items)} at {l.next.at} ({l.next.more} more){:else}All tiers
            unlocked{/if}
        </p>
        <table class="reward-table">
          <tbody>
            {#each l.rows as r (r.at)}
              <tr class={r.cls}>
                <td class="reward-mark">{r.mark}</td>
                <td class="reward-at">{r.at}</td>
                <td class="reward-name"
                  >{#if r.rank}<span class="reward-rank">{r.rank}</span>{' '}{/if}{@render rewardItems(r.items)}{#if r.togo}{' '}<span class="reward-togo">{r.togo} to go</span>{/if}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>

  <h3 class="section-title" style="margin-top:26px">Event Bonuses</h3>
  {#if page.banner}
    {@const b = page.banner}
    {#if b.live}
      <div class="ref-event-banner live">
        <strong>{b.name}</strong> is on until {b.until}. Anyone who enlists with your code and buys a game package gets
        you: <strong>{b.reward}</strong>.
      </div>
    {:else}
      <div class="ref-event-banner">
        No bonus event right now. The last one was <strong>{b.name}</strong> ({b.start}, {b.reward}). CIG runs one every
        few months.
      </div>
    {/if}
  {/if}
  <p class="muted" style="font-size:12px;margin:0 0 12px">
    A recruit who <strong>converted</strong> during a special-incentive event earns you that event's bonus reward, once
    per event. The event list refreshes weekly from the Star Citizen wiki.
  </p>
  {#if page.events.length}
    <p class="reward-next-line" style="margin-bottom:10px">
      <strong>{page.events.length}</strong> event bonus reward(s) earned.
    </p>
    <ul class="event-list">
      {#each page.events as e (e.name)}
        <li class="event-item">
          <span class="event-check">✓</span>
          <span class="event-text">{e.name}: {e.reward}</span>
          <span class="event-date">{e.date}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">No recruits converted during a tracked bonus event. Next IAE, maybe.</p>
  {/if}

  <h3 class="section-title" style="margin-top:26px">People</h3>
  <div class="ref-list-controls">
    <div class="ref-tabs">
      <button class="ref-tab" class:active={tab === 'recruits'} data-reftab="recruits" onclick={() => pickTab('recruits')}
        >Recruits <b>{nf(st.recruits)}</b></button
      >
      <button
        class="ref-tab"
        class:active={tab === 'prospects'}
        data-reftab="prospects"
        onclick={() => pickTab('prospects')}>Prospects <b>{nf(st.prospects)}</b></button
      >
    </div>
    <input
      id="ref-search"
      class="ref-search"
      type="search"
      placeholder="Search handle / moniker…"
      aria-label="Search Referrals"
      bind:value={query}
    />
    <select id="ref-sort" class="ref-sort" aria-label="Sort Referrals" bind:value={sort}>
      <option value="newest">Newest First</option>
      <option value="oldest">Oldest First</option>
      <option value="name">Name (A–Z)</option>
    </select>
  </div>
  <div id="ref-count" class="result-count">Showing {nf(people.rows.length)} of {nf(people.total)}</div>
  <div class="ref-table-scroll">
    <table class="ref-table">
      <thead>
        <tr><th>Handle</th><th>Moniker</th><th id="ref-date-col">{tab === 'recruits' ? 'Converted' : 'Enlisted'}</th></tr>
      </thead>
      <tbody id="ref-tbody">
        {#each people.rows as r, i (i)}
          <tr>
            <td class="r-handle"
              >{#if r.url}<a class="ref-citizen-link" href={r.url} target="_blank" rel="noopener">{r.handle}</a
                >{:else}{r.handle}{/if}{#if r.legacy}{' '}<span class="ref-badge legacy">legacy</span>{/if}</td
            >
            <td>{r.moniker}</td>
            <td
              >{r.when}{#if r.ev}{' '}<span class="ref-event" title={r.ev}>★</span>{/if}</td
            >
          </tr>
        {:else}
          <tr>
            <td colspan="3" class="muted">
              {people.total ? `No ${tab} match your search.` : `No ${tab} found.`}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
