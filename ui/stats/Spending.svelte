<script>
  // Stats → Spending: what you've pledged per year (by pledge date) and the running
  // total. Uses each pledge's melt value, the store credit you'd get back, so gifts
  // and rewards count as $0 and upgrades count what they added.
  import { app, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const byYear = new Map();
    let undated = 0;
    for (const p of a.state.items) {
      const y = /^(\d{4})/.exec(p.date || '');
      const v = Number.isFinite(p.value) ? p.value : 0;
      if (!y) {
        undated += v;
        continue;
      }
      const cur = byYear.get(y[1]) || { n: 0, sum: 0 };
      cur.n++;
      cur.sum += v;
      byYear.set(y[1], cur);
    }
    if (!byYear.size) return null;
    const years = [...byYear.keys()].sort();
    const first = Number(years[0]);
    const last = Number(years[years.length - 1]);
    const all = [];
    for (let y = first; y <= last; y++)
      all.push([String(y), byYear.get(String(y)) || { n: 0, sum: 0 }]);
    const total = all.reduce((acc, [, r]) => acc + r.sum, 0) + undated;
    const max = Math.max(1, ...all.map(([, r]) => r.sum));
    const best = all.reduce((b, cur) => (cur[1].sum > b[1].sum ? cur : b));
    let running = 0;
    return {
      boxes: [
        [a.money(total), 'pledged in total'],
        [`${all.length}`, `years (${first} to ${last})`],
        [a.money(total / all.length), 'average per year'],
        [best[0], `biggest year (${a.money(best[1].sum)})`],
      ],
      bars: all.map(([y, r]) => {
        running += r.sum;
        return {
          y,
          pct: Math.round((r.sum / max) * 100),
          sum: a.money(r.sum),
          more: `· ${r.n} pledge${r.n === 1 ? '' : 's'} · total ${a.money(running)}`,
        };
      }),
      undated: undated ? a.money(undated) : '',
    };
  });
</script>

{#if !d}
  <p class="muted">
    No dated pledges yet. Hit Scan at the top and we’ll do the math on your spending (gently).
  </p>
{:else}
  <div class="stat-grid">
    {#each d.boxes as [big, lbl]}
      <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
    {/each}
  </div>
  <h3 class="section-title" style="margin-top:22px">By Year</h3>
  {#each d.bars as b}
    <div class="bar-row">
      <div class="bar-label">{b.y}</div>
      <div class="bar-track"><div class="bar-fill" style="width:{b.pct}%"></div></div>
      <div class="bar-val spend-val">{b.sum} <span class="muted">{b.more}</span></div>
    </div>
  {/each}
  <p class="muted value-note">
    By pledge date, using each pledge's melt value (the store credit it would return), so gifts and
    rewards count as $0 and upgrades count only what they added.{d.undated
      ? ` ${d.undated} of pledges have no date.`
      : ''} Stays on your PC like everything else.
  </p>
{/if}
