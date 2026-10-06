<script>
  // The top bar on every page (Top Bar and Top Menu Pass in docs/REDESIGN-0.3.md),
  // Option A, More Menu (owner pick, 2026-10-06; #260): the logo, Home, Inventory,
  // Buy-Backs and Store, then More ▾ for Stats, Org Fleet and Referrals (More lights up
  // when you are on one of them). On the right, small controls only: the search icon
  // (opens the field over the page links, or press /), the Game Status pill (dot and
  // version), the alerts bell, Scan ▾ and your portrait (a green dot once synced, sync
  // builds). One row at every width from 800px up: under 900px the logo drops its
  // word and Scan All drops to its icon. Pinned while scrolling everywhere but Home;
  // it slims down while you scroll down.
  import { app, version } from '../lib/app.svelte.js';
  import Bell from './Bell.svelte';
  import GameStatus from './GameStatus.svelte';
  import MoreMenu from './MoreMenu.svelte';
  import ScanSplit from './ScanSplit.svelte';
  import TopSearch from './TopSearch.svelte';
  import YouMenu from './YouMenu.svelte';

  let { header } = $props();

  const MAIN = [
    ['home', 'Home'],
    ['inventory', 'Inventory'],
    ['buybacks', 'Buy-Backs'],
    ['store', 'Store'],
  ];

  const d = $derived.by(() => {
    version.n;
    return { view: app().top.view };
  });

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

<a class="brand" href="#home" data-view="home" aria-label="Open Hangar, Home"
  ><img class="brand-mark" src="../icons/icon128.png" alt="" />
  <h1>Open Hangar</h1></a
>
<nav id="nav" aria-label="Pages">
  {#each MAIN as [view, label] (view)}
    <a
      href="#{view}"
      data-view={view}
      class:active={d.view === view}
      aria-current={d.view === view ? 'page' : undefined}>{label}</a
    >
  {/each}
  <MoreMenu view={d.view} />
</nav>
<div class="hdr-prefs">
  <!-- Language flags go here once the dashboard is translated (TODO.md). -->
  <!-- Search your hangar from any page: an icon that opens the field (/ too). -->
  <TopSearch />
  <!-- LIVE / PTU, patch notes and events (ui/lib/game-status.js). -->
  <GameStatus />
  <!-- Hangar Alerts from any page. -->
  <Bell />
  <ScanSplit />
  <!-- Your menu; sync builds put the Synced dot on the portrait (ui/site). -->
  <YouMenu />
</div>
