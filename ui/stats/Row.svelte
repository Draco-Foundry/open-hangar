<script>
  // A top-list row. With `item` (a pledge id) or `bb` (a buy-back id) it opens that
  // pledge or buy-back: the dashboard's shared click handler reads data-open-item /
  // data-open-bb, and Enter or Space work like a click on any role="button".
  let { name, item = null, bb = null, children } = $props();
  const open = $derived(item != null || bb != null);
</script>

{#if open}
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
{:else}
  <div class="row"><div class="nm">{name}</div><div class="vl">{@render children()}</div></div>
{/if}
