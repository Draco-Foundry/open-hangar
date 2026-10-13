<script>
  // "Export ▾" and its menu. Items are { act, label, hint }; each is a
  // [data-export] button, handled by the classic click handler in dashboard.js.
  // The menu is pinned under its button (right edges lined up), above it when
  // there's no room below, and closes on a click outside or Escape.
  import { placeUnder } from './place.js';

  let { ids = {}, items = [] } = $props();
  let open = $state(false);
  let btn = $state();
  let menu = $state();
  let pos = $state({ right: 8, top: 0 });

  function place() {
    pos = placeUnder(btn, menu);
  }
  async function toggle(e) {
    e.stopPropagation();
    open = !open;
    if (open) {
      place();
      await Promise.resolve();
      place(); // again, now the menu has its height
    }
  }
  $effect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'click' && menu?.contains(e.target) && !e.target.closest('[data-export]'))
        return;
      open = false;
    };
    // After the click that opened it has finished.
    const t = setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('keydown', close);
      window.addEventListener('scroll', close, { passive: true });
    });
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close);
    };
  });
</script>

<div class="exp-wrap">
  <button
    bind:this={btn}
    id={ids.button}
    class="mk-btn exp-btn"
    type="button"
    aria-haspopup="true"
    aria-expanded={open}
    onclick={toggle}>Export ▾</button
  >
  <div
    bind:this={menu}
    id={ids.menu}
    class="scan-menu exp-menu"
    hidden={!open}
    style:right="{pos.right}px"
    style:top="{pos.top}px"
  >
    {#each items as it (it.act)}
      <button type="button" class="menu-item" data-export={it.act}
        >{it.label}<small>{it.hint}</small></button
      >
    {/each}
  </div>
</div>
