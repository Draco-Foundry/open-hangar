<script>
  // Hangar Alerts from any page: the bell with a count, and the same alerts as
  // Home's list in a drop-down, with × to ignore one (it comes back if something new
  // happens) and Clear All. ui/home/ForYou.svelte publishes the list on
  // window.OHApp.alerts and fires 'oh:alerts' when it changes.
  import { app } from '../lib/app.svelte.js';
  import { menus, register, toggleMenu, menuClick, closeMenus } from './menus.svelte.js';

  let n = $state(0);
  let seen = 0;
  $effect(() => {
    // Written, never read here: ForYou fires 'oh:alerts' from inside its own effect,
    // which would otherwise start depending on `n` and loop.
    const bump = () => (n = ++seen);
    document.addEventListener('oh:alerts', bump);
    return () => document.removeEventListener('oh:alerts', bump);
  });
  const list = $derived.by(() => {
    n;
    return app().alerts?.list || [];
  });
  const quip = $derived.by(() => {
    list;
    return window.OH.quip('caughtUp');
  });

  let btn = $state();
  let menu = $state();
  $effect(() => register('bell', btn, menu));

  const ignore = (x) => app().alerts.ignore(x.key);
  function clearAll() {
    for (const x of list) ignore(x);
  }
  function go(e, x) {
    if (x.go) {
      e.preventDefault();
      x.go();
    }
    closeMenus();
  }
</script>

<div class="bell-wrap">
  <button
    bind:this={btn}
    id="bell-btn"
    class="icon-btn"
    type="button"
    aria-haspopup="true"
    aria-expanded={menus.open === 'bell'}
    aria-label="Hangar Alerts"
    title="Hangar Alerts"
    onclick={(e) => toggleMenu('bell', e)}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5
          1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z"
      /></svg
    ><span class="badge-n" id="bell-n" hidden={!list.length}
      >{list.length > 9 ? '9+' : String(list.length)}</span
    >
  </button>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menu}
    id="bell-menu"
    class="scan-menu bell-menu"
    hidden={menus.open !== 'bell'}
    onclick={menuClick}
  >
    <div class="bm-head">
      <span
        >{list.length
          ? `${list.length} alert${list.length === 1 ? '' : 's'}`
          : 'All caught up'}</span
      >
      {#if list.length}
        <button type="button" class="bm-clear" onclick={clearAll}>Clear All</button>
      {/if}
    </div>
    {#each list as x}
      <div class="bm-row {x.kind || ''}">
        <a href={x.href || '#home'} onclick={(e) => go(e, x)}
          ><b>{x.title}</b><small>{x.sub || ''}</small></a
        ><button
          type="button"
          class="bm-x"
          title="Ignore"
          aria-label="Ignore: {x.title}"
          onclick={() => ignore(x)}>×</button
        >
      </div>
    {:else}
      <p class="bm-none">
        {quip} Alerts land here when a wishlist ship goes on sale, a ship you own turns flight
        ready, and more.
      </p>
    {/each}
  </div>
</div>
