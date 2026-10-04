<script>
  // A buy-back's way back: its reclaim page on RSI, or "Retired" when RSI no longer
  // sells it back (#306).
  let { r } = $props();
</script>

{#if r && r.retired}
  <span class="bb-retired" title={r.retired}>Retired</span>
{:else if r}
  <a class="bb-reclaim" href={r.url} target="_blank" rel="noopener" title={r.tip}>Reclaim ↗</a>
{/if}
