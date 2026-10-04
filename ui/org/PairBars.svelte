<script>
  // Two-series bars: one row per key, `a` and `b` side by side.
  import { app } from '../lib/app.svelte.js';

  let { a, b, labelA, labelB } = $props();
  const rows = $derived.by(() => {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(
      (x, y) => (b[y] || 0) + (a[y] || 0) - ((b[x] || 0) + (a[x] || 0)),
    );
    const max = Math.max(1, ...keys.map((k) => Math.max(a[k] || 0, b[k] || 0)));
    const pct = (n) => Math.round((n / max) * 100);
    return keys.map((k) => ({
      label: app().org.titleCase(k),
      a: a[k] || 0,
      b: b[k] || 0,
      pa: pct(a[k] || 0),
      pb: pct(b[k] || 0),
    }));
  });
</script>

<div class="pair-legend">
  <span class="sw a"></span>{labelA} <span class="sw b"></span>{labelB}
</div>
{#each rows as r}
  <div class="pair-row">
    <div class="bar-label">{r.label}</div>
    <div class="pair-bars">
      <div class="pair-bar a" style="width:{r.pa}%"><span>{r.a}</span></div>
      <div class="pair-bar b" style="width:{r.pb}%"><span>{r.b}</span></div>
    </div>
  </div>
{/each}
