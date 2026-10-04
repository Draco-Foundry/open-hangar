<script>
  // Stats → Buy-Backs: counts, what buying everything back would cost, tokens, the
  // most valuable ones and the ships melted most often. A row opens that buy-back.
  import { app, version } from '../lib/app.svelte.js';
  import Box from './Box.svelte';
  import Bar from './Bar.svelte';
  import Row from './Row.svelte';

  const a = app();
  const d = $derived.by(() => {
    version.n;
    const st = a.state;
    const bbs = st.buybacks;
    if (!bbs.length) return null;
    const byKind = a.bbKinds
      .map((k) => ({
        label: k.label,
        n: bbs.filter((b) => b.kind === k.key).length,
        type: a.typeKeys.includes(k.key) ? k.key : '',
      }))
      .filter((r) => r.n);
    const kindMax = Math.max(1, ...byKind.map((r) => r.n));
    const priced = bbs.map((b) => ({ b, v: a.bbPrice(b) })).filter((x) => x.v);
    const total = priced.reduce((s, x) => s + x.v, 0);
    const real = bbs.filter((b) => a.bbDetail(b)).length;
    // Most melted: the same ship melted again and again.
    const counts = new Map();
    for (const b of bbs) {
      if (b.isCCU) continue;
      const k = String(b.name || '')
        .replace(/^\s*.+?\s+[-–]\s/, '')
        .trim();
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return {
      boxes: [
        [bbs.length, 'buy-backs'],
        [
          a.dollars(total),
          `to buy all back${real < bbs.length ? ' (≈, load details for real prices)' : ''}`,
        ],
        [st.bbTokens != null ? st.bbTokens : '—', 'buy-back tokens'],
        [a.nextTokenDate() || '—', 'next token'],
        [`${real} / ${bbs.length}`, 'with details loaded'],
      ],
      byKind: byKind.map((r) => ({ ...r, pct: Math.round((r.n / kindMax) * 100) })),
      top: priced
        .sort((x, y) => y.v - x.v)
        .slice(0, 10)
        .map(({ b, v }) => ({ id: String(b.id), name: a.buybackName(b), val: a.dollars(v) })),
      most: [...counts]
        .filter((r) => r[1] > 1)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 10),
    };
  });
</script>

{#if !d}
  <p class="muted">No buy-backs yet. Hit Scan at the top to pull them in.</p>
{:else}
  <div class="stat-grid">
    {#each d.boxes as [big, lbl] (lbl)}<Box {big} {lbl} />{/each}
  </div>
  <h3 class="section-title">By Type</h3>
  {#each d.byKind as r}<Bar label={r.label} pct={r.pct} val={r.n} type={r.type} />{/each}
  <h3 class="section-title" style="margin-top:26px">Most Valuable to Buy Back</h3>
  <div class="top-list">
    {#each d.top as x}
      <Row name={x.name} bb={x.id}>{x.val}</Row>
    {:else}
      <div class="row muted">No prices yet.</div>
    {/each}
  </div>
  {#if d.most.length}
    <h3 class="section-title" style="margin-top:26px">Melted Most Often</h3>
    <div class="top-list">
      {#each d.most as [n, k]}<Row name={n}>×{k}</Row>{/each}
    </div>
  {/if}
{/if}
