<script>
  // Stats → Overview: headline counts, pledges by category, top pledges by value.
  import { app, OH, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const items = a.state.items;
    const lib = OH();
    const count = (k) => items.filter((p) => p.kind === k).length;
    // Breakdown by kind (count + subtotal), as bars scaled to the largest count.
    const present = a.presentKinds();
    const maxN = Math.max(1, ...present.map((k) => count(k.key)));
    return {
      boxes: [
        [items.length, 'pledges'],
        [a.money(lib.totalValue(items)), 'melt value'],
        [items.filter((p) => p.containsShip).length, 'with ships'],
        [count('ccu'), 'CCUs'],
        [count('addon'), 'add-ons'],
        [count('coupon'), 'coupons'],
      ],
      bars: present.map((k) => {
        const n = count(k.key);
        return {
          label: k.label,
          pct: Math.round((n / maxN) * 100),
          val: `${n} · ${a.money(lib.totalValue(items.filter((p) => p.kind === k.key)))}`,
        };
      }),
      top: items
        .filter((p) => Number.isFinite(p.value))
        .sort((x, y) => y.value - x.value)
        .slice(0, 10)
        .map((p) => ({ id: p.id, name: a.plainName(p), value: a.formatValue(p) })),
    };
  });
</script>

<div class="stat-grid">
  {#each d.boxes as [big, lbl]}
    <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
  {/each}
</div>
<h3 class="section-title">By Category</h3>
{#each d.bars as b}
  <div class="bar-row">
    <div class="bar-label">{b.label}</div>
    <div class="bar-track"><div class="bar-fill" style="width:{b.pct}%"></div></div>
    <div class="bar-val">{b.val}</div>
  </div>
{/each}
<h3 class="section-title" style="margin-top:26px">Top Pledges by Value</h3>
<div class="top-list">
  {#each d.top as p}
    <div class="row"><div class="nm">{p.name}</div><div class="vl">{p.value}</div></div>
  {:else}
    <div class="row muted">No priced pledges.</div>
  {/each}
</div>
