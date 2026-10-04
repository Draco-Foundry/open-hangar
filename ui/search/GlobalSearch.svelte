<script>
  // One Global Hangar Search box and its results (Home's, or the top bar's). Rows are
  // grouped by where the match lives, packs first; a row opens that pledge or buy-back
  // (data-open-item / data-open-bb, handled in src/dashboard.js), and the search
  // starts empty again (#178): a result, Escape, a click away or another page clears
  // it. Typing under two letters hides the results but keeps what's typed.
  import { flushSync } from 'svelte';
  import { app } from '../lib/app.svelte.js';
  import SearchPic from './SearchPic.svelte';

  let { where, host } = $props();
  const home = where === 'home';

  let input;
  let panel;
  let open = $state(false);
  let r = $state(null);

  function find() {
    const q = input.value;
    if (q.trim().length < 2) {
      open = false;
    } else {
      r = { q: q.trim(), ...app().search.results(q) };
      open = true;
    }
    // Drawn now, so Enter (and anything reading the panel) sees these results.
    flushSync();
  }
  function close() {
    open = false;
    if (input) input.value = '';
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      close();
      input.blur();
    } else if (e.key === 'Enter') {
      panel.querySelector('.gs-row')?.click(); // opens it, then clears
    }
  }
  // "Get Details" reads the unchecked packs' pages; any row opens (dashboard.js),
  // then the search clears.
  function onPanelClick(e) {
    if (e.target.closest('[data-gs-bbdetails]')) {
      close();
      app().search.getDetails();
    } else if (e.target.closest('.gs-row')) close();
  }

  $effect(() => {
    // Home's box: a click anywhere outside a search box. The top bar's: outside it.
    const onDocClick = (e) => {
      const inside = home ? e.target.closest('.gsearch') : host.contains(e.target);
      if (!inside && (input.value || open)) close();
    };
    // While results are open the wheel scrolls them, wherever the mouse is over the
    // panel (gaps, titles, footer, edges), and never hands the scroll to the page
    // (#168). Home's dims the page behind, so that doesn't scroll either.
    const onWheel = (e) => {
      if (!open) return;
      const inside = panel.contains(e.target);
      if (!inside && !home) return;
      e.preventDefault();
      const list = panel.querySelector('.gs-scroll');
      if (list && inside) list.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    // On the box itself, not delegated: code that sets the value and fires a plain
    // (non-bubbling) input event gets results too, as with the classic box.
    const onFocus = () => input.value.trim().length >= 2 && find();
    input.addEventListener('input', find);
    input.addEventListener('focus', onFocus);
    input.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('oh:close-search', close);
    window.addEventListener('hashchange', close);
    return () => {
      input.removeEventListener('input', find);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('oh:close-search', close);
      window.removeEventListener('hashchange', close);
    };
  });

  const shown = $derived(r ? r.pledges.length + r.buybacks.length + r.rewards.length : 0);
  const count = (rows, n) => (n > rows.length ? `${rows.length} of ${n}` : n);
</script>

{#snippet pack(row)}
  <span class="gs-where">
    {#if row.inside}Inside <b>{row.inside}</b>{:else if row.note}{row.note}{/if}
    {#if (row.inside || row.note) && row.date}<em>·</em>{/if}
    {#if row.date}<em>{row.date}</em>{/if}
  </span>
{/snippet}

{#snippet rich(row, attrs)}
  <button type="button" class="gs-row gs-rich" {...attrs}>
    <SearchPic img={row.img} resolve={row.resolve} label={row.name} />
    <span class="gs-info">
      <span class="gs-name">{row.name}</span>
      {@render pack(row)}
      <span class="gs-tags">
        {#each row.tags as t (t.text + t.cls)}<span class="gs-tag {t.cls}">{t.text}</span>{/each}
      </span>
    </span>
    <span class="gs-side">
      {#if row.val}<b>{row.val}</b>{#if row.valLbl}<small>{row.valLbl}</small>{/if}{/if}
      <span class="gs-open">Details →</span>
    </span>
  </button>
{/snippet}

{#snippet note()}
  {#if r.unchecked}
    <div class="gs-note">
      {r.unchecked} buy-back pack{r.unchecked === 1 ? '' : 's'} not checked yet ·
      <button type="button" class="gs-note-btn" data-gs-bbdetails>Get Details</button>
    </div>
  {/if}
{/snippet}

{#if !home}
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
    />
  </svg>
{/if}
<input
  bind:this={input}
  id={home ? 'gsearch' : 'gsearch-top'}
  type="search"
  placeholder={home ? 'Global Hangar Search' : 'Search'}
  autocomplete="off"
  aria-label={home
    ? 'Search ships, hangar, buy-backs and rewards'
    : 'Search your hangar, buy-backs and rewards'}
/>
<kbd class="gsearch-key" title={home ? 'Press / on any page to search' : undefined}>/</kbd>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  bind:this={panel}
  id={home ? 'gsearch-results' : 'gsearch-top-results'}
  class="gsearch-results"
  class:top-results={!home}
  hidden={!open}
  onclick={onPanelClick}
>
  {#if r}
    {#if !shown}
      <div class="gs-none">
        Nothing in your hangar, buy-backs or referral rewards matches "{r.q}".
      </div>
      {@render note()}
    {:else}
      <div class="gs-scroll">
        {#if r.pledges.length}
          <div class="gs-group">
            <div class="gs-title">
              <span>In Your Hangar</span><span>{count(r.pledges, r.pledgeCount)}</span>
            </div>
            {#each r.pledges as row (row.key)}
              {@render rich(row, { 'data-open-item': row.item })}
            {/each}
          </div>
        {/if}
        {#if r.buybacks.length}
          <div class="gs-group">
            <div class="gs-title">
              <span>In Your Buy-Backs</span><span>{count(r.buybacks, r.bbCount)}</span>
            </div>
            {#each r.buybacks as row (row.key)}
              {@render rich(row, { 'data-open-bb': row.bb })}
            {/each}
          </div>
        {/if}
        {@render note()}
        {#if r.rewards.length}
          <div class="gs-group">
            <div class="gs-title">
              <span>Earned Rewards</span><span>{r.rewards.length}</span>
            </div>
            {#each r.rewards as row (row.key)}
              <a class="gs-row gs-rich" href="#referrals">
                <SearchPic label={row.name} />
                <span class="gs-info">
                  <span class="gs-name">{row.name}</span>
                  <span class="gs-where">Referral reward <em>· {row.sub}</em></span>
                </span>
                <span class="gs-side"><span class="gs-open">Referrals →</span></span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
      <div class="gs-foot">
        <span>{shown} result{shown === 1 ? '' : 's'} · Enter opens the first</span>
        <span>Searching your hangar, buy-backs and rewards</span>
      </div>
    {/if}
  {/if}
</div>
