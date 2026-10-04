<script>
  // The filters that are on, as pills above the list (× removes one, Clear All
  // removes them all). They show whether the sidebar is open or folded away.
  // Each is { group, key, label, title }.
  let { active = [], onRemove, onClearAll } = $props();
</script>

{#if active.length}
  <div class="oh-active" aria-label="Active Filters">
    {#each active as a (a.group + '|' + a.key)}
      <span class="oh-af"
        ><i>{a.title}:</i> {a.label}<button
          type="button"
          aria-label="Remove {a.label}"
          title="Remove"
          onclick={() => onRemove(a.group, a.key)}>✕</button
        ></span
      >
    {/each}
    <button type="button" class="oh-clearall" onclick={onClearAll}>Clear All</button>
  </div>
{/if}
