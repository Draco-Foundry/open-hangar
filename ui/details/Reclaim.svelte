<script>
  // A buy-back's way back: its reclaim page on RSI. A retired ship (#306) says so,
  // but RSI still sells it back, so the label links there too. Pledges RSI never
  // sells back say "Can't Be Bought Back" (#403).
  let { r } = $props();
</script>

{#if r && r.blocked}
  <span class="bb-retired bb-blocked" title={r.blocked}>Can't Be Bought Back</span>
{:else if r && r.retired && r.url}
  <a class="bb-retired" href={r.url} target="_blank" rel="noopener" title={r.retired}
    >Retired, Buy-Back Still Open ↗</a
  >
{:else if r && r.retired}
  <span class="bb-retired" title={r.retired}>Retired, Buy-Back Still Open</span>
{:else if r}
  <a class="bb-reclaim" href={r.url} target="_blank" rel="noopener" title={r.tip}>Reclaim ↗</a>
{/if}
