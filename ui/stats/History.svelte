<script>
  // Stats → History: account value over time (one point per scan, on the same rules
  // as Home's Account Value), a log of what changed per scan, and a backup button
  // (scans and history live in this browser, plus the website's copy once synced).
  import { app, OH, version } from '../lib/app.svelte.js';
  import { flag } from '../lib/flags.js';

  // Builds with website sync mention the synced copy (docs/FLAGS.md).
  const sync = flag('sync');

  const W = 560,
    H = 150,
    L = 56,
    R = 10,
    T = 10,
    B = 22;

  function chart(a, hist) {
    const pts = hist.map((h) => ({ t: h.at, v: a.snapshotStore(h), note: a.creditNote(h) }));
    const t0 = pts[0].t,
      t1 = pts[pts.length - 1].t || t0 + 1;
    const vmin = Math.min(...pts.map((p) => p.v)),
      vmax = Math.max(...pts.map((p) => p.v));
    const span = vmax - vmin || 1;
    const x = (t) => (L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R)).toFixed(1);
    const y = (v) => (T + (1 - (v - vmin) / span) * (H - T - B)).toFixed(1);
    return {
      line: pts.map((p) => `${x(p.t)},${y(p.v)}`).join(' '),
      dots: pts.map((p) => ({
        cx: x(p.t),
        cy: y(p.v),
        tip: `${a.fmtDay(p.t)}: ${a.dollars(p.v)}${p.note}`,
      })),
      max: a.dollars(vmax),
      min: a.dollars(vmin),
      from: a.fmtDay(t0),
      to: a.fmtDay(t1),
    };
  }

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const hist = s.history || [];
    const t = s.lastBackupAt;
    const days = t ? Math.floor((Date.now() - t) / 86400000) : null;
    const backup = {
      text: !t ? 'never backed up' : `last backup ${a.fmtDay(t)}`,
      stale: !t || days > 60,
    };
    if (!hist.length) return { backup };
    if (hist.length < 2) return { backup, since: a.fmtDay(hist[0].at) };
    const steps = [];
    for (let i = hist.length - 1; i > 0 && steps.length < 12; i--) {
      const diff = OH().diffSnapshots(hist[i - 1], hist[i]);
      steps.push({
        at: hist[i].at,
        date: a.fmtDay(hist[i].at),
        summary: a.changeSummary(diff),
        changes: [
          ...diff.added.map((c) => ['add', `+ ${c.name} (${a.money(c.value)})`]),
          ...diff.removed.map((c) => ['del', `− ${c.name} (${a.money(c.value)})`]),
          ...diff.changed.map((c) => [
            'chg',
            `~ ${c.from} → ${c.to} (${a.money(c.fromValue)} → ${a.money(c.toValue)})`,
          ]),
        ],
      });
    }
    return {
      backup,
      chart: s.priceOf ? chart(a, hist) : null,
      steps,
      count: hist.length,
    };
  });
</script>

{#if d.since}
  <p class="muted">
    Tracking since {d.since}. Rescan after your hangar changes and each change shows up here.
  </p>
{:else if d.steps}
  <h3 class="section-title" id="history">Account Value Over Time</h3>
  {#if d.chart}
    <svg class="hist-chart" viewBox="0 0 {W} {H}" role="img" aria-label="Account value over time">
      <text x={L - 6} y={T + 8} text-anchor="end">{d.chart.max}</text>
      <text x={L - 6} y={H - B} text-anchor="end">{d.chart.min}</text>
      <text x={L} y={H - 4}>{d.chart.from}</text>
      <text x={W - R} y={H - 4} text-anchor="end">{d.chart.to}</text>
      <polyline points={d.chart.line} fill="none" stroke="currentColor" stroke-width="2" />
      {#each d.chart.dots as p}
        <circle cx={p.cx} cy={p.cy} r="3"><title>{p.tip}</title></circle>
      {/each}
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
    {#each d.steps as st}
      <details class="hist-step">
        <summary><span class="hist-date">{st.date}</span> {st.summary}</summary>
        <ul class="changes">
          {#each st.changes as [cls, text]}<li class={cls}>{text}</li>{/each}
        </ul>
      </details>
    {/each}
  </div>
  <p class="muted value-note">
    A snapshot is kept each time a full scan finds changes: {d.count} so far, up to the last 100.
  </p>
{:else}
  <p class="muted">
    Your flight log starts with your next scan: every scan that finds changes gets logged here.
  </p>
{/if}
<div class="backup-row">
  <button class="mk-btn" type="button" data-backup>Download Backup</button>
  <span class="muted"
    ><span class={d.backup.stale ? 'stale' : undefined}>{d.backup.text}</span> · {sync
      ? "Your scans and this history live in this browser, plus a synced copy on openhangar.space once you connect. Uninstalling the extension or moving to another browser loses this browser's copy."
      : 'Your scans and this history live only in this browser. Uninstalling the extension or moving to another browser loses them.'}
    Keep the file somewhere safe (a Drive or OneDrive folder works) and restore it with
    Developers → Import JSON.</span
  >
</div>
