<script>
  // Search in the top bar (Top Bar Option A, owner 2026-10-06): a search icon that
  // opens the field over the page links, on a click or on / (ui/search/main.js
  // focuses the field, which opens it). The field and its results are Global Hangar
  // Search's own (#top-search, ui/search), moved in here once and unchanged. Escape,
  // a click away, opening a result or another page closes it again; while it's shut
  // the field stays focusable for / but out of the Tab order.
  import { flushSync } from 'svelte';
  import { closeMenus } from './menus.svelte.js';

  let open = $state(false);
  let wrap = $state();
  let btn = $state();
  const field = () => document.getElementById('gsearch-top');

  // Move the search box (it mounts into #top-search in the page's <header>) in here.
  function adopt(node) {
    const box = document.getElementById('top-search');
    if (box) node.appendChild(box);
  }

  function show() {
    if (open) return;
    closeMenus();
    open = true;
  }
  function hide(refocus = false) {
    if (!open) return;
    // Drawn shut first: the icon is hidden under the open field until then.
    flushSync(() => (open = false));
    if (refocus) btn?.focus({ preventScroll: true });
  }

  $effect(() => {
    const set = () => {
      const input = field();
      if (input) input.tabIndex = open ? 0 : -1;
    };
    set();
    // The box mounts after the bar (ui/search loads later), so once more on load.
    if (document.readyState !== 'complete') window.addEventListener('load', set, { once: true });
  });

  $effect(() => {
    if (!wrap) return;
    const onFocusIn = (e) => {
      if (e.target === field()) show();
    };
    // Shut once focus has left with nothing typed (a result opening clears the box).
    const onFocusOut = () =>
      setTimeout(() => {
        if (!wrap.contains(document.activeElement) && !field()?.value) hide();
      }, 0);
    const onKey = (e) => {
      if (e.key === 'Escape' && e.target === field()) hide(true);
    };
    const onDocClick = (e) => {
      if (!wrap.contains(e.target)) hide();
    };
    const onHash = () => hide();
    // Another menu opening shuts the search.
    const onMenus = () => hide();
    wrap.addEventListener('focusin', onFocusIn);
    wrap.addEventListener('focusout', onFocusOut);
    wrap.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    document.addEventListener('oh:close-menus', onMenus);
    window.addEventListener('hashchange', onHash);
    return () => {
      wrap.removeEventListener('focusin', onFocusIn);
      wrap.removeEventListener('focusout', onFocusOut);
      wrap.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('oh:close-menus', onMenus);
      window.removeEventListener('hashchange', onHash);
    };
  });

  function onClick(e) {
    e.stopPropagation();
    show();
    field()?.focus({ preventScroll: true });
  }
</script>

<div class="tb-search" class:open bind:this={wrap}>
  <button
    bind:this={btn}
    id="top-search-btn"
    class="icon-btn tb-search-btn"
    type="button"
    aria-label="Search Your Hangar (/)"
    title="Search Your Hangar (/)"
    aria-expanded={open}
    aria-controls="top-search"
    onclick={onClick}
    ><svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
    ></button
  >
  <div class="tb-search-slot" style="display: contents" use:adopt></div>
</div>
