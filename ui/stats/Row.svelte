<script>
  // A list row that opens a pledge (item) or buy-back (bb) through the classic
  // [data-open-item] / [data-open-bb] click handler.
  let { item = null, bb = null, name, children } = $props();
</script>

<div
  class="row clickable"
  tabindex="0"
  role="button"
  data-open-item={item != null ? String(item) : undefined}
  data-open-bb={bb != null ? String(bb) : undefined}
>
  <div class="nm">{name}</div>
  <div class="vl">{@render children()}</div>
</div>
