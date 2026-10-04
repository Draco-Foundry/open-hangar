<script>
  // Bar rows scaled to the largest value: [label, n, title?, type?] (type colours the
  // bar like that item type).
  let { rows, fmt = (n) => n } = $props();
  const max = $derived(Math.max(1, ...rows.map((r) => r[1])));
</script>

{#each rows as [label, n, title, type]}
  <div class="bar-row" title={title || undefined}>
    <div class="bar-label">{label}</div>
    <div class="bar-track">
      <div
        class="bar-fill{type ? ` t-${type}` : ''}"
        style="width:{Math.round((n / max) * 100)}%"
      ></div>
    </div>
    <div class="bar-val">{fmt(n)}</div>
  </div>
{/each}
