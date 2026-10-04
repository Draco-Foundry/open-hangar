<script>
  // One card in Inventory (list="inv": a pledge) or Buy-Backs (list="bb"). What it
  // shows comes from OHApp.inv.card / OHApp.bb.card. The class names and data-*
  // attributes are the ones the page's CSS and the document-level handlers use:
  // Enter / Space on a focused card clicks it, and the details pop-up returns focus
  // to the card with the same data-id. Resting on a card starts the download of its
  // sharp picture, so the details pop-up opens sharp.
  import { app, version } from './app.svelte.js';
  import Thumb from './Thumb.svelte';
  import BbPrice from './BbPrice.svelte';
  import Reclaim from './Reclaim.svelte';
  import ItemName from './ItemName.svelte';

  let { item, list, layout } = $props();

  const c = $derived.by(() => {
    version.n;
    return list === 'bb' ? app().bb.card(item) : app().inv.card(item);
  });
  // Select mode (Inventory): picked cards are marked.
  const selected = $derived.by(() => {
    version.n;
    return list !== 'bb' && app().inv.isSelected(c.id);
  });
  let art = $state(''); // art the picture found (no RSI picture, or a broken one)
  const image = $derived(art || c.image); // what the card shows (hover preload uses it)

  function foundArt(url, isArt) {
    art = url;
    app().setArt(list, c.id, url, isArt);
  }

  function click(e) {
    if (list === 'bb') {
      if (e.target.closest('a')) return; // let links (Reclaim) work normally
      app().bb.open(c.id);
    } else app().inv.click(c.id);
  }

  let hoverTimer = 0;
  function hover() {
    clearTimeout(hoverTimer);
    if (image) hoverTimer = setTimeout(() => app().preloadPicture(image), 120);
  }
</script>

{#snippet thumb(kind, dataKind)}
  <Thumb
    src={c.image}
    {kind}
    {dataKind}
    resolve={c.resolve}
    rsiImage={c.rsiImage}
    {layout}
    onArt={foundArt}
  />
{/snippet}

<!-- Enter and Space on a focused card click it: the document-level keyboard handler in
     src/dashboard.js (kbdClickable), shared with the Stats rows. A buy-back card is a
     focusable group (it holds a Reclaim link), as before the port. -->
{#if list === 'bb'}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="card"
    tabindex="0"
    role="group"
    aria-label={c.label}
    data-id={c.id}
    data-image={image}
    data-resolve={c.resolve}
    data-rsi-image={c.rsiImage}
    onclick={click}
    onmouseenter={hover}
    onmouseleave={() => clearTimeout(hoverTimer)}
  >
    {@render thumb('Buy-Back')}
    <div class="card-body">
      <div class="card-name" title={c.label}>
        <ItemName x={c} />{#if c.n > 1}{' '}<span class="stack-n">×{c.n}</span>{/if}
      </div>
      <div class="card-contents">{c.contents}</div>
      <div class="card-foot">
        <span class="foot-left"><span class="badge {c.badge}">{c.type}</span></span>
        <span class="bb-date">{c.date}</span>
        <span class="bb-end"
          >{#if c.price}<BbPrice p={c.price} />{/if}{#if c.under}<small class="under"
              >{c.under} under store</small
            >{/if}{#if c.reclaim}<Reclaim r={c.reclaim} />{/if}</span
        >
      </div>
    </div>
  </div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="card"
    class:selected
    tabindex="0"
    role="button"
    data-id={c.id}
    data-image={image}
    data-resolve={c.resolve}
    data-rsi-image={c.rsiImage}
    onclick={click}
    onmouseenter={hover}
    onmouseleave={() => clearTimeout(hoverTimer)}
  >
    {@render thumb(c.kind, c.kind)}
    <div class="card-body">
      <div class="card-name" title={c.title}>
        <ItemName x={c} />
      </div>
      <div class="card-contents">{c.contents}</div>
      <div class="card-ins" title="Insurance">{c.ins}</div>
      <div class="card-foot">
        <span class="foot-left"
          ><span class="badge {c.badge}">{c.type}</span><span class="flags"
            >{#each c.flags as f (f.letter)}<span
                class="flag {f.state}"
                title={f.label}
                aria-label={f.label}
                ><span class="fl-s">{f.letter}</span><span class="fl-l">{f.word}</span></span
              >{/each}</span
          ></span
        >
        <span class="val" title={c.valTitle || undefined}
          >{c.val}{#if c.under}<small class="under">{c.under} under store</small>{/if}</span
        >
      </div>
    </div>
  </div>
{/if}
