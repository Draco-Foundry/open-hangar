<script>
  // A grid of cards in one layout (gallery, compact or list), drawing the first
  // `limit` of `items` (see progress.svelte.js). `list` is "inv" or "bb" (Card.svelte).
  import Card from './Card.svelte';
  import { keyed } from './progress.svelte.js';

  let { items, list, layout, limit = Infinity } = $props();
  const shown = $derived(keyed(items, limit));
</script>

<div class="grid {layout}">
  {#each shown as x (x.k)}<Card item={x.item} {list} {layout} />{/each}
</div>
