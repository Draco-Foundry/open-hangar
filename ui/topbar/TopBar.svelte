<script>
  // The top bar on every page (Top Bar and Top Menu Pass in docs/REDESIGN-0.3.md):
  // the logo, the page links with counts beside Inventory and Buy-Backs (a row you
  // swipe on a phone), then the search box, the alerts bell, Scan ▾ and your menu.
  // Pinned while scrolling everywhere but Home; it slims down while you scroll down.
  import { app, version } from '../lib/app.svelte.js';
  import Bell from './Bell.svelte';
  import ScanSplit from './ScanSplit.svelte';
  import YouMenu from './YouMenu.svelte';

  let { header } = $props();

  const PAGES = [
    ['home', 'Home'],
    ['inventory', 'Inventory'],
    ['buybacks', 'Buy-Backs'],
    ['stats', 'Stats'],
    ['store', 'Store'],
    ['org', 'Org Fleet'],
    ['referrals', 'Referrals'],
  ];

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const n = (count) => (count ? a.compactNum(count) : '');
    return {
      view: a.top.view,
      counts: { inventory: n(a.state.items.length), buybacks: n(a.state.buybacks.length) },
    };
  });

  // The search box (ui/search) mounts into #top-search in the page's <header>; this
  // moves it into its place in the bar, once.
  function adopt(node) {
    const box = document.getElementById('top-search');
    if (box) node.appendChild(box);
  }

  // The bar slims down while you scroll down a long page, and comes back on the way up.
  $effect(() => {
    if (!header) return;
    let anchorY = 0; // where the current scroll direction started
    let lockUntil = 0; // ignore the jump the bar's own resize causes
    // Stuck section headers sit right under the bar (--hdr-h, ui/theme.css), so it
    // has to follow the bar's real height as it slims (#177).
    const syncHeight = () =>
      document.documentElement.style.setProperty('--hdr-h', `${header.offsetHeight}px`);
    const setSlim = (on) => {
      if (document.body.classList.contains('bar-slim') === on) return;
      document.body.classList.toggle('bar-slim', on);
      lockUntil = performance.now() + 350;
      syncHeight();
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (performance.now() < lockUntil) {
        anchorY = y;
        return;
      }
      if (y < 140) setSlim(false);
      else if (y - anchorY > 48) setSlim(true); // a real move down
      else if (anchorY - y > 48) setSlim(false); // a real move up
      else return;
      anchorY = y;
    };
    header.addEventListener('transitionend', syncHeight);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Border box: slimming only changes the bar's padding, which a content-box
    // observer never sees.
    const ro = 'ResizeObserver' in window ? new ResizeObserver(syncHeight) : null;
    ro?.observe(header, { box: 'border-box' });
    return () => {
      header.removeEventListener('transitionend', syncHeight);
      window.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  });
</script>

<a class="brand" href="#home" data-view="home"
  ><img class="brand-mark" src="../icons/icon128.png" alt="" />
  <h1>Open Hangar</h1></a
>
<nav id="nav">
  {#each PAGES as [view, label] (view)}
    <a href="#{view}" data-view={view} class:active={d.view === view}
      >{label}{#if view in d.counts}{' '}<span class="nav-n" id="nav-n-{view}"
            >{d.counts[view]}</span
          >{/if}</a
    >
  {/each}
</nav>
<div class="hdr-prefs">
  <!-- Language flags go here once the dashboard is translated (TODO.md). -->
  <!-- Search your hangar from any page (/ focuses it). -->
  <div class="top-search-slot" style="display: contents" use:adopt></div>
  <!-- Hangar Alerts from any page. -->
  <Bell />
  <ScanSplit />
  <YouMenu />
</div>

