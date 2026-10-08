<script>
  // The summary strip on top of Inventory and Buy-Backs: the page title, a note
  // (e.g. "Totals follow your filters"), anything the page adds under them (Open on
  // Website), then a few big numbers. Each stat is { label, value, title?, small?,
  // good? }.
  let { title, note = '', stats = [], children } = $props();
</script>

<div class="page-sum">
  <div>
    <h2>{title}</h2>
    {#if note}<div class="ps-note">{note}</div>{/if}
    {@render children?.()}
  </div>
  <div class="ps-stats">
    {#each stats as s (s.label)}
      <div class="ps-st" title={s.title || undefined}>
        <div class="ps-l">{s.label}</div>
        <div class="ps-v">
          {#if s.good}<span class="ps-good">{s.value}</span>{:else}{s.value}{/if}{#if s.small}<small
              >{s.small}</small
            >{/if}
        </div>
      </div>
    {/each}
  </div>
</div>
