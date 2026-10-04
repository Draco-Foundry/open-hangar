<script>
  // Stats → Buy-Backs: what reclaiming everything would cost, by type, the most
  // valuable ones, and ships melted again and again.
  import { app, version } from '../lib/app.svelte.js';
  import Bars from './Bars.svelte';
  import Row from './Row.svelte';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    const bbs = s.buybacks;
    if (!bbs.length) return null;
    const byKind = a.bbKinds
      .map((k) => [
        k.label,
        bbs.filter((b) => b.kind === k.key).length,
        '',
        a.typeKeys.includes(k.key) ? k.key : '',
      ])
      .filter((r) => r[1]);
    const priced = bbs.map((b) => ({ b, v: a.bbPrice(b) })).filter((x) => x.v);
    const total = priced.reduce((acc, x) => acc + x.v, 0);
    const real = bbs.filter((b) => a.bbDetail(b)).length;
    // Most-melted: same ship melted again and again.
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
        [s.bbTokens != null ? s.bbTokens : '—', 'buy-back tokens'],
        [a.nextTokenDate() || '—', 'next token'],
        [`${real} / ${bbs.length}`, 'with details loaded'],
      ],
      byKind,
      top: priced
        .sort((x, y) => y.v - x.v)
        .slice(0, 10)
        .map(({ b, v }) => ({ id: b.id, name: a.buybackName(b), price: a.dollars(v) })),
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
    {#each d.boxes as [big, lbl]}
      <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
    {/each}
  </div>
  <h3 class="section-title">By Type</h3>
  <Bars rows={d.byKind} />
  <h3 class="section-title" style="margin-top:26px">Most Valuable to Buy Back</h3>
  <div class="top-list">
    {#each d.top as b}
      <Row bb={b.id} name={b.name}>{b.price}</Row>
    {:else}
      <div class="row muted">No prices yet.</div>
    {/each}
  </div>
  {#if d.most.length}
    <h3 class="section-title" style="margin-top:26px">Melted Most Often</h3>
    <div class="top-list">
      {#each d.most as [n, k]}
        <div class="row"><div class="nm">{n}</div><div class="vl">×{k}</div></div>
      {/each}
    </div>
  {/if}
{/if}
