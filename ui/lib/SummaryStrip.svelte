<script>
  // The summary strip on top of Inventory and Buy-Backs: the page title, a note
  // (e.g. "Totals follow your filters"), anything the page adds under them (Open on
  // Website), then a few big numbers. Each stat is { label, value, title?, small?,
  // good?, go?, on? }: with `go`, its number is a button that turns that filter on and
  // off (`on`: the filter is on now; owner, 2026-10-09).
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
          {#if s.go}<button type="button" class="ps-go" class:ps-good={s.good} aria-pressed={!!s.on} onclick={s.go}
              >{s.value}</button
            >{:else if s.good}<span class="ps-good">{s.value}</span>{:else}{s.value}{/if}{#if s.small}<small
              >{s.small}</small
            >{/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* A number that's also its filter: looks like the number, underlined on hover,
     outlined while its filter is on. */
  .ps-go {
    padding: 0 4px;
    margin: 0 -4px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .ps-go:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .ps-go[aria-pressed='true'] {
    border-color: currentColor;
  }
</style>
