<script>
  // A card's or row's name: a CCU as "From → To", anything else by its name.
  let { x } = $props();
</script>

{#if x.ccu}{x.ccu.from} <span class="ccu-flow">→</span> {x.ccu.to}{:else}{x.name}{/if}
