<script>
  // One bar per key of a { key: count } map, biggest first, scaled to the largest.
  import { app } from '../lib/app.svelte.js';

  let { map } = $props();
  const rows = $derived.by(() => {
    const list = Object.entries(map).sort((x, y) => y[1] - x[1]);
    const max = Math.max(1, ...list.map((r) => r[1]));
    return list.map(([k, n]) => ({
      label: app().org.titleCase(k),
      n,
      pct: Math.round((n / max) * 100),
    }));
  });
</script>

{#each rows as r}
  <div class="bar-row">
    <div class="bar-label">{r.label}</div>
    <div class="bar-track"><div class="bar-fill" style="width:{r.pct}%"></div></div>
    <div class="bar-val">{r.n}</div>
  </div>
{/each}
