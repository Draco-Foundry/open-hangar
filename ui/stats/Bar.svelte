<script>
  // One bar-chart row: label, a bar `pct` wide (0-100), the value on the right and
  // an optional muted note after it. `type` colours the bar like that item type.
  let { label, pct, val, note = '', title = '', type = '', valClass = '' } = $props();
</script>

<div class="bar-row" title={title || undefined}>
  <div class="bar-label">{label}</div>
  <div class="bar-track"><div class="bar-fill{type ? ` t-${type}` : ''}" style="width:{pct}%"></div></div>
  <div class="bar-val{valClass ? ` ${valClass}` : ''}">{val}{#if note}{' '}<span class="muted">{note}</span>{/if}</div>
</div>
