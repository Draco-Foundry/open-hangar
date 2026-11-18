<script>
  // The ⓘ: a small round button that opens a pop-up on hover or focus, and holds it open
  // on a tap or a click (owner, 2026-11-17: a hover pop-up after a name or a button). The
  // switch rows (./OptInRow.svelte) and the first-run setup draw every ⓘ with it, so it
  // looks the same everywhere (One Display). `text` is the pop-up, `note` a second line
  // under it; `label` names the button for screen readers; `open` and `ontoggle` hold it
  // open from outside. `id`: `${id}-btn` the button, `${id}` the pop-up. Its look is in
  // ./opt-in-row.css (a component's own style block would land in ui/shared.css, which
  // the popup and the basic page don't load).
  let { id, label, text, note = '', open = false, ontoggle } = $props();
  let hover = $state(false);
  const shown = $derived(open || hover);
</script>

<span class="oh-tip-at">
  <button
    type="button"
    class="oh-tip"
    id="{id}-btn"
    aria-expanded={shown}
    aria-controls={id}
    aria-label={label}
    onmouseenter={() => (hover = true)}
    onmouseleave={() => (hover = false)}
    onfocus={() => (hover = true)}
    onblur={() => (hover = false)}
    onclick={ontoggle}>i</button
  >
  {#if shown}<span class="oh-tip-pop" {id} role="tooltip"
      >{text}{#if note}<b>{note}</b>{/if}</span
    >{/if}
</span>
