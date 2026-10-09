<script>
  // A buy-back's Buy Back link (RSI's page, or for a CCU its one-item list entry), the
  // same words in the same spot on every card (owner, 2026-10-09). A retired ship
  // (#306) keeps the link and a short "Retired*" mark whose tooltip says what it means;
  // a card shows that mark as a chip beside its type instead (`mark={false}`).
  // Pledges RSI never sells back say "Can't Be Bought Back" (#403).
  // `r` is { blocked } | { url, tip, retired? } | { retired }.
  import { RETIRED_TIP } from './retired-tip.js';
  let { r, mark = true } = $props();
</script>

{#if r.blocked}<span class="bb-retired bb-blocked" title={r.blocked}>Can't Be Bought Back</span
  >{:else}{#if r.retired && mark}<span class="bb-retired-mark" title={RETIRED_TIP}>Retired*</span
    >{/if}{#if r.url}<a class="bb-reclaim" href={r.url} target="_blank" rel="noopener" title={r.tip}
      >Buy Back ↗</a
    >{/if}{/if}
