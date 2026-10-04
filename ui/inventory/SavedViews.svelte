<script>
  // Saved views: one click back to a set of filters. The [data-view-*] buttons
  // are handled by the classic click handler in src/dashboard.js (apply, remove,
  // and "+ Save This View", which asks for a name).
  let { views = [], current = '' } = $props();
</script>

<div class="views" id="inv-views">
  {#if views.length}<span class="views-lbl">Saved Views</span>{/if}
  {#each views as v, i (i + v.name)}
    <span class="view-chip" class:on={JSON.stringify(v.f) === current}
      ><button type="button" data-view-apply={i}>★ {v.name}</button><button
        type="button"
        class="view-x"
        data-view-del={i}
        title="Remove this view"
        aria-label="Remove {v.name}">×</button
      ></span
    >
  {/each}
  <button type="button" class="view-add" data-view-save>+ Save This View</button>
</div>
