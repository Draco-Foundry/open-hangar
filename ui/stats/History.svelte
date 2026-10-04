<script>
  // Stats → History: account value over time (a hand-drawn SVG line, no chart
  // library) and a log of what changed at each scan. History lives only in this
  // browser, so the tab ends with a backup button and how old the last backup is.
  import { app, OH, version } from '../lib/app.svelte.js';

  const a = app();
  const W = 560,
    H = 150,
    L = 56,
    R = 10,
    T = 10,
    B = 22;

  // The chart: each snapshot valued like Account Value today (OHApp.snapshotStore).
  function chart(hist) {
    const pts = hist.map((h) => ({ t: h.at, v: a.snapshotStore(h), note: a.creditNote(h) }));
    const t0 = pts[0].t,
      t1 = pts[pts.length - 1].t || t0 + 1;
    const vmin = Math.min(...pts.map((p) => p.v)),
      vmax = Math.max(...pts.map((p) => p.v));
    const span = vmax - vmin || 1;
    const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
    const y = (v) => T + (1 - (v - vmin) / span) * (H - T - B);
    return {
      line: pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '),
      dots: pts.map((p) => ({
        cx: x(p.t).toFixed(1),
        cy: y(p.v).toFixed(1),
        tip: `${a.fmtDay(p.t)}: ${a.dollars(p.v)}${p.note}`,
      })),
      vmax: a.dollars(vmax),
      vmin: a.dollars(vmin),
      t0: a.fmtDay(t0),
      t1: a.fmtDay(t1),
    };
  }

  // What changed between two snapshots, one line each.
  function changes(diff) {
    const m = a.money;
    return [
      ...diff.added.map((x) => ['add', `+ ${x.name} (${m(x.value)})`]),
      ...diff.removed.map((x) => ['del', `− ${x.name} (${m(x.value)})`]),
      ...diff.changed.map((x) => [
        'chg',
        `~ ${x.from} → ${x.to} (${m(x.fromValue)} → ${m(x.toValue)})`,
      ]),
    ];
  }

  const d = $derived.by(() => {
    version.n;
    const st = a.state;
    const hist = st.history;
    const t = st.lastBackupAt;
    const days = t ? Math.floor((Date.now() - t) / 86400000) : null;
    const backup = !t
      ? { text: 'never backed up', stale: true }
      : { text: `last backup ${a.fmtDay(t)}`, stale: days > 60 };
    if (!hist.length) return { backup };
    if (hist.length < 2) return { backup, since: a.fmtDay(hist[0].at) };
    const steps = [];
    for (let i = hist.length - 1; i > 0 && steps.length < 12; i--) {
      const diff = OH().diffSnapshots(hist[i - 1], hist[i]);
      steps.push({ day: a.fmtDay(hist[i].at), sum: a.changeSummary(diff), lines: changes(diff) });
    }
    return { backup, chart: st.priceOf ? chart(hist) : null, steps, n: hist.length };
  });
</script>

{#if d.steps}
  <h3 class="section-title" id="history">Account Value Over Time</h3>
  {#if d.chart}
    {@const c = d.chart}
    <svg class="hist-chart" viewBox="0 0 {W} {H}" role="img" aria-label="Account value over time">
      <text x={L - 6} y={T + 8} text-anchor="end">{c.vmax}</text>
      <text x={L - 6} y={H - B} text-anchor="end">{c.vmin}</text>
      <text x={L} y={H - 4}>{c.t0}</text>
      <text x={W - R} y={H - 4} text-anchor="end">{c.t1}</text>
      <polyline points={c.line} fill="none" stroke="currentColor" stroke-width="2" />
      {#each c.dots as p}<circle cx={p.cx} cy={p.cy} r="3"><title>{p.tip}</title></circle>{/each}
    </svg>
    <p class="muted value-note tight">
      Everything you held at each scan, valued like Account Value today: ships at today's store
      prices, CCUs at standard price, everything else at melt value, plus Store Credit from scans
      that recorded it. Pledges you've since melted are estimated from their names.
    </p>
  {:else}
    <p class="muted">Loading ship prices…</p>
  {/if}
  <div class="hist-list">
    {#each d.steps as s}
      <details class="hist-step">
        <summary><span class="hist-date">{s.day}</span> {s.sum}</summary>
        <ul class="changes">
          {#each s.lines as [cls, text]}<li class={cls}>{text}</li>{/each}
        </ul>
      </details>
    {/each}
  </div>
  <p class="muted value-note">
    A snapshot is kept each time a full scan finds changes: {d.n} so far, up to the last 100.
  </p>
{:else if d.since}
  <p class="muted">
    Tracking since {d.since}. Rescan after your hangar changes and each change shows up here.
  </p>
{:else}
  <p class="muted">
    Your flight log starts with your next scan: every scan that finds changes gets logged here.
  </p>
{/if}
<div class="backup-row">
  <button class="mk-btn" type="button" data-backup>Download Backup</button>
  <span class="muted"
    >{#if d.backup.stale}<span class="stale">{d.backup.text}</span>{:else}{d.backup.text}{/if} · Your
    scans and this history live only in this browser. Uninstalling the extension or moving to another
    browser loses them. Keep the file somewhere safe (a Drive or OneDrive folder works) and restore it
    with Developers → Import JSON.</span
  >
</div>
