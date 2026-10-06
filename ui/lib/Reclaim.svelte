<script>
  // A buy-back's Reclaim link (RSI's page, or for a CCU its one-item list entry). A
  // retired ship (#306) is labelled, still linked: RSI still sells it back.
  // Pledges RSI never sells back say "Can't Be Bought Back" (#403).
  // `r` is { blocked } | { url, tip, retired? } | { retired }.
  let { r } = $props();
</script>

{#if r.blocked}<span class="bb-retired bb-blocked" title={r.blocked}
    >Can't Be Bought Back</span
  >{:else if r.retired && r.url}<a
    class="bb-retired"
    href={r.url}
    target="_blank"
    rel="noopener"
    title={r.retired}>Retired, Buy-Back Still Open ↗</a
  >{:else if r.retired}<span class="bb-retired" title={r.retired}>Retired, Buy-Back Still Open</span>{:else}<a
    class="bb-reclaim"
    href={r.url}
    target="_blank"
    rel="noopener"
    title={r.tip}>Reclaim ↗</a
  >{/if}
