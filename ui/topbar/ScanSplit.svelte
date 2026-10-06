<script>
  // Scan ▾ on every page. The button runs what's ticked in the ▾ menu ("Scan All",
  // or "Scan Custom" once a source is unticked; remembered in scanSources) and is
  // its own progress bar while a scan runs ("Scanning… 2/4", then "✓ Landed"), with
  // what it's on in its hover text and at the top of the menu (#170). A scan that
  // ends with a problem leaves "Rough Landing" and its report (ScanReport.svelte)
  // until the next scan. The scan itself, and the progress, live in dashboard.js
  // (window.OHApp.top). Sync builds put the website's section in the menu
  // (#scan-menu-site, filled by ui/site).
  import { app, version } from '../lib/app.svelte.js';
  import {
    menus,
    register,
    toggleMenu,
    openMenu,
    closeMenus,
    menuClick,
  } from './menus.svelte.js';
  import ScanReport from './ScanReport.svelte';

  const SOURCES = [
    { value: 'hangar', name: 'Inventory', hint: 'Your pledges, ships and upgrades' },
    { value: 'buybacks', name: 'Buy-Backs', hint: 'Melted pledges you can get back' },
    { value: 'referrals', name: 'Referrals', hint: "Recruits and the rewards you've earned" },
    { value: 'store', name: 'Store', hint: 'Is anything on your wishlist for sale?' },
  ];

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const bar = a.top.bar;
    const on = SOURCES.filter((s) => bar.sources.includes(s.value));
    const all = on.length === SOURCES.length;
    const what = all
      ? 'Scan everything: inventory, buy-backs, referrals and your wishlist in the store'
      : on.length
        ? `Scan ${on.map((s) => s.name).join(', ')} (change with ▾)`
        : 'Nothing ticked: pick what to scan with ▾';
    const at = a.state.scannedAt;
    // After a scan with a problem the button says Rough Landing and opens the report.
    const report = bar.busy ? null : bar.report;
    return {
      busy: bar.busy,
      scanning: bar.scanning,
      fill: bar.scanning ? bar.fill : 0,
      report,
      rough: !!report,
      label: bar.scanning
        ? bar.label
        : report
          ? report.label || 'Rough Landing'
          : all
            ? 'Scan All'
            : 'Scan Custom',
      // The progress owns the hover text while it shows.
      title: bar.scanning
        ? bar.title
        : report
          ? 'See how the last scan went'
          : at
            ? `${what}\nLast scan: ${new Date(at).toLocaleString()}`
            : what,
      detail: bar.detail,
      sources: [...bar.sources],
    };
  });

  // How the button draws its label (Top Bar Option A, 2026-10-06): an icon and the
  // words, at one steady width so nothing beside it moves. "Scanning 2/4" while a scan
  // runs (narrow bars keep just "2/4"), a tick and "Landed", the warning sign and
  // "Rough Landing". Under 900px only the icon (or the count) shows; the words stay
  // in the hover text and the label.
  const ICONS = {
    scan: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    done: '<path d="m5 12 5 5 9-10"/>',
    warn: '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  };
  const look = $derived.by(() => {
    const label = d.label;
    const m = /^Scanning…\s*(\d+)\/(\d+)$/.exec(label);
    if (m) return { icon: 'scan', word: 'Scanning', count: `${m[1]}/${m[2]}`, aria: `Scanning ${m[1]} of ${m[2]}` };
    if (/^✓\s*/.test(label)) {
      const word = label.replace(/^✓\s*/, '');
      return { icon: 'done', word, aria: `Scan ${word}` };
    }
    if (d.rough || label === 'Rough Landing') return { icon: 'warn', word: label, aria: label };
    // The website sync step: shorter in the bar, the whole line in the hover text.
    if (label === 'Syncing to Website…') return { icon: 'scan', word: 'Syncing…', aria: label };
    return { icon: 'scan', word: label, aria: label };
  });

  let btn = $state();
  let menu = $state();
  let scanBtn = $state();
  let reportPanel = $state();
  $effect(() => register('scan', btn, menu));
  $effect(() => {
    if (reportPanel) register('report', scanBtn, reportPanel);
  });
  // A new report opens by itself, wherever you are (focus stays where it was).
  let shownN = 0;
  $effect(() => {
    const n = d.report && d.report.n;
    if (!n || n === shownN || !reportPanel) return;
    shownN = n;
    // After this update settles (opening redraws the page right away).
    queueMicrotask(() => openMenu('report', { focus: false }));
  });

  function onScan(e) {
    if (d.report) toggleMenu('report', e);
    else app().top.scan();
  }
  function closeReport() {
    closeMenus();
    scanBtn?.focus({ preventScroll: true });
  }

  function tick(value, on) {
    const list = d.sources.filter((v) => v !== value);
    app().top.setSources(on ? [...list, value] : list);
  }
</script>

<div class="scan-split">
  <button
    bind:this={scanBtn}
    id="scan-home"
    class:scanning={d.scanning}
    class:rough={d.rough || d.label === 'Rough Landing'}
    class:counting={!!look.count}
    disabled={d.busy}
    title={d.title}
    aria-label={look.aria}
    aria-haspopup={d.report ? 'dialog' : undefined}
    aria-expanded={d.report ? menus.open === 'report' : undefined}
    onclick={onScan}
  >
    <span class="scan-fill" style:width="{d.fill}%"></span><span class="scan-label"
      ><svg
        class="scan-ic {look.icon}"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">{@html ICONS[look.icon]}</svg
      >{#if look.count}<span class="sl-word">{look.word}</span>
        <span class="sl-count">{look.count}</span>{:else}<span class="sl-word">{look.word}</span
        >{/if}</span
    >
  </button>
  <button
    bind:this={btn}
    id="scan-menu-btn"
    class="scan-caret"
    aria-haspopup="true"
    aria-expanded={menus.open === 'scan'}
    aria-label="Scan options"
    title="Choose what to scan"
    onclick={(e) => toggleMenu('scan', e)}
    ><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
      ><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" /></svg
    ></button
  >
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menu}
    id="scan-menu"
    class="scan-menu sm-rich"
    hidden={menus.open !== 'scan'}
    onclick={menuClick}
  >
    <!-- While a scan runs: what it's on (#170). -->
    <div class="sm-progress" id="scan-menu-progress" role="status" hidden={!d.detail}
      >{d.detail ? `Scanning: ${d.detail}` : ''}</div
    >
    <div class="sm-head">
      <span>What to Scan</span><button
        type="button"
        class="sm-all"
        data-scan-all
        onclick={() => app().top.setSources(SOURCES.map((s) => s.value))}>Select All</button
      >
    </div>
    {#each SOURCES as s (s.value)}
      <label class="sm-opt"
        ><input
          type="checkbox"
          class="scan-src"
          value={s.value}
          data-name={s.name}
          checked={d.sources.includes(s.value)}
          onchange={(e) => tick(s.value, e.currentTarget.checked)}
        /><span class="sm-txt"><b>{s.name}</b><small>{s.hint}</small></span></label
      >
    {/each}
    <button id="scan-selected" class="scan-go" disabled={d.busy} onclick={() => app().top.scan()}
      >Scan Now</button
    >
    <!-- openhangar.space: Connected as, Sync Now, Open My Hangar, Disconnect (ui/site). -->
    <div id="scan-menu-site" style="display: contents"></div>
  </div>
  {#if d.report}
    <ScanReport r={d.report} bind:panel={reportPanel} onClose={closeReport} />
  {/if}
</div>
