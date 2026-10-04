<script>
  // One "label: value" line of a detail window.
  let { k, children } = $props();
</script>

<div class="mr"><span class="mr-k">{k}</span><span class="mr-v">{@render children()}</span></div>
