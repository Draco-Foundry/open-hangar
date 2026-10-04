<script>
  // A buy-back's Reclaim link (RSI's page, or for a CCU its one-item list entry), or
  // "Retired" when the ship can't be reclaimed (#306). `r` is { retired } | { url, tip }.
  let { r } = $props();
</script>

{#if r.retired}<span class="bb-retired" title={r.retired}>Retired</span>{:else}<a
    class="bb-reclaim"
    href={r.url}
    target="_blank"
    rel="noopener"
    title={r.tip}>Reclaim ↗</a
  >{/if}
