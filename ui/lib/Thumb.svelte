<script>
  // A card's picture (Inventory and Buy-Backs). RSI's picture in two sizes (srcset)
  // so the browser downloads just the one it needs. If it fails: first drop to the
  // plain src, then try the same picture once more after 1.5 s (RSI's image server
  // sometimes drops a request), then show the placeholder and look up the ship's art
  // once by name. A card with no picture looks its art up only when it comes near
  // the screen (ui/lib/art.js); a CCU shows its target ship, RSI's generic upgrade
  // picture (rsiImage) only as the fallback. onArt(url, isArt) reports art found.
  import { untrack } from 'svelte';
  import { app, OH } from './app.svelte.js';
  import { whenNear } from './art.js';

  let { src = '', kind = '', dataKind, resolve = '', rsiImage = '', layout, onArt } = $props();

  let art = $state(''); // the looked-up picture
  let looked = false; // one lookup per card, never a loop
  let tries = $state({}); // url → 1: srcset dropped, 2: retrying, 3: gave up
  let retry = $state({}); // url → the retry address
  const usable = (u) => !!u && (tries[u] || 0) < 3;
  const url = $derived(usable(src) ? src : usable(art) ? art : '');
  const set = $derived(url && !tries[url] ? app().srcsetFor(url) : '');

  function lookUp(fallback) {
    if (looked || !resolve) return;
    looked = true;
    return OH()
      .getShipImage(resolve)
      .then((found) => {
        const u = found || (fallback ? rsiImage : '');
        if (!u) return;
        // The art is often the very picture that just failed (art found earlier is
        // kept as the card's picture): give it a fresh start, like a new <img>.
        delete tries[u];
        delete retry[u];
        art = u;
        onArt?.(u, !!found);
      });
  }

  function onerror(e) {
    const img = e.currentTarget;
    const u = url;
    const t = tries[u] || 0;
    // The browser picked the bigger size and it failed: drop to the plain src.
    if (t === 0 && img.hasAttribute('srcset')) {
      tries[u] = 1;
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      return;
    }
    if (t < 2 && /^https?:/.test(img.src)) {
      tries[u] = 2;
      const s = img.src;
      setTimeout(() => {
        if (img.isConnected) retry[u] = s + (s.includes('?') ? '&' : '?') + 'retry=1';
      }, 1500);
      return;
    }
    tries[u] = 3;
    // RSI's link is broken: the ship's art by name, if there is one.
    if (u === src) lookUp(false)?.catch(() => {});
  }

  // No picture at all: look the art up once the card is near the screen.
  function near(node) {
    const stop = untrack(() =>
      src || looked || !resolve ? null : whenNear(node, () => lookUp(true)),
    );
    return { destroy: () => stop?.() };
  }
</script>

{#if url}
  <img
    class="thumb"
    loading="lazy"
    data-kind={dataKind}
    data-retried={tries[url] >= 2 ? '1' : undefined}
    src={retry[url] || url}
    srcset={set || undefined}
    sizes={set ? app().cardSizes(layout) : undefined}
    alt=""
    {onerror}
  />
{:else}
  <div class="thumb placeholder" use:near>{kind}</div>
{/if}
