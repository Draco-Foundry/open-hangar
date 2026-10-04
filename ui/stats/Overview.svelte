<script>
  // Stats → Overview: headline counts, pledges by category, top pledges by value.
  import { app, OH, version } from '../lib/app.svelte.js';
  import Box from './Box.svelte';
  import Bar from './Bar.svelte';
  import Row from './Row.svelte';

  const a = app();
  const d = $derived.by(() => {
    version.n;
    const lib = OH();
    const items = a.state.items;
    const count = (k) => items.filter((p) => p.kind === k).length;
    const present = a.presentKinds();
    // Bars scaled to the largest count.
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
        const sub = lib.totalValue(items.filter((p) => p.kind === k.key));
        return { key: k.key, label: k.label, pct: Math.round((n / maxN) * 100), val: `${n} · ${a.money(sub)}` };
      }),
      top: items
        .filter((p) => Number.isFinite(p.value))
        .sort((x, y) => y.value - x.value)
        .slice(0, 10)
        .map((p) => ({ name: a.plainName(p), val: a.formatValue(p) })),
    };
  });
</script>

<div class="stat-grid">
  {#each d.boxes as [big, lbl] (lbl)}<Box {big} {lbl} />{/each}
</div>
<h3 class="section-title">By Category</h3>
{#each d.bars as b (b.key)}<Bar label={b.label} pct={b.pct} val={b.val} />{/each}
<h3 class="section-title" style="margin-top:26px">Top Pledges by Value</h3>
<div class="top-list">
  {#each d.top as p}
    <Row name={p.name}>{p.val}</Row>
  {:else}
    <div class="row muted">No priced pledges.</div>
  {/each}
</div>
