<script>
  // More ▾ in the page links (Top Bar Option A, owner 2026-10-06; #260): Stats, Org
  // Fleet and Referrals, one click deeper. On one of those pages More itself shows as
  // active and the page is marked inside the menu. Lined up with More's left edge;
  // the shared menu rules (menus.svelte.js) open, close and move focus.
  import { menus, register, toggleMenu, menuClick } from './menus.svelte.js';

  let { view } = $props();

  const MORE = [
    ['stats', 'Stats', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
    [
      'org',
      'Org Fleet',
      '<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/><path d="M8 12h8M12 8v8"/>',
    ],
    [
      'referrals',
      'Referrals',
      '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 8v6M14 11h6"/>',
    ],
  ];
  const here = $derived(MORE.find(([v]) => v === view));

  let btn = $state();
  let menu = $state();
  $effect(() => register('more', btn, menu, { left: true }));
</script>

<span class="more-wrap">
  <button
    bind:this={btn}
    id="more-btn"
    class="more-btn"
    class:active={!!here}
    class:open={menus.open === 'more'}
    type="button"
    aria-haspopup="true"
    aria-expanded={menus.open === 'more'}
    aria-controls="more-menu"
    aria-label={here ? `More Pages, you are on ${here[1]}` : 'More Pages'}
    title={here ? `You are on ${here[1]}` : 'Stats, Org Fleet and Referrals'}
    onclick={(e) => toggleMenu('more', e)}
    >More<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"
      ><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" /></svg
    ></button
  >
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menu}
    id="more-menu"
    class="scan-menu more-menu"
    aria-label="More Pages"
    hidden={menus.open !== 'more'}
    onclick={menuClick}
  >
    {#each MORE as [v, label, icon] (v)}
      <a
        class="more-item"
        class:active={v === view}
        href="#{v}"
        data-view={v}
        aria-current={v === view ? 'page' : undefined}
        ><svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">{@html icon}</svg
        >{label}</a
      >
    {/each}
  </div>
</span>
