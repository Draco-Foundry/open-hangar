<script>
  // The window's picture: RSI's art, except a CCU shows the ship it upgrades to;
  // with no RSI art, the ship looked up by name. It starts as the placeholder, shows
  // whichever picture turns up, then quietly swaps in a sharper copy. The picture is
  // a button: click (or Enter) opens it full size (#299).
  import { app, OH } from '../lib/app.svelte.js';

  let { art, name, onZoom } = $props();
  const real = $derived(art.real || '');
  const resolve = $derived(art.resolve || '');
  const preferShip = $derived(!!art.preferShip);

  let url = $state(''); // the picture found (the thumbnail)
  let src = $state(''); // what's on screen: the thumbnail, then its sharper copy
  let btn = $state();
  let img = $state();

  $effect(() => {
    const r = real;
    const name = resolve;
    let live = true;
    url = '';
    if (!name || (r && !preferShip)) url = r;
    else
      OH()
        .getShipImage(name)
        .then((found) => {
          if (live) url = found || r;
        });
    return () => (live = false);
  });
  $effect(() => {
    const u = url;
    src = u;
    if (!u) return;
    let live = true;
    app()
      .detail.hiRes(u)
      .then((hi) => {
        if (live && hi) src = hi;
      });
    return () => (live = false);
  });
</script>

{#if url}
  <button
    bind:this={btn}
    type="button"
    class="modal-img-btn"
    title="View Full Size"
    aria-label={name ? `View Full Size: ${name}` : 'View Full Size'}
    onclick={() => onZoom(img.currentSrc || img.src, url, name, btn)}
  >
    <img bind:this={img} class="modal-img" alt={name} {src} />
    <span class="modal-img-hint" aria-hidden="true">Full Size</span>
  </button>
{:else}
  <div class="modal-img placeholder">{art.placeholder}</div>
{/if}
