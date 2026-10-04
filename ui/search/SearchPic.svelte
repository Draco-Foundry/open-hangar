<script>
  // A result's picture: RSI's art when the row has it, else the ship's picture from
  // the wiki (looked up a few at a time, cached by lib.js), else its name.
  import { OH } from '../lib/app.svelte.js';
  import { whenNear } from '../lib/art.js';

  let { img, resolve, label } = $props();
  let found = $state('');
  let node;

  $effect(() => {
    found = '';
    if (img || !resolve || !node) return;
    const name = resolve;
    return whenNear(node, async () => {
      const url = await OH().getShipImage(name);
      if (url && name === resolve) found = url;
    });
  });
  const src = $derived(img || found);
</script>

<span class="gs-img" bind:this={node}>
  {#if src}<img {src} alt="" loading="lazy" />{:else}<span>{label || ''}</span>{/if}
</span>
