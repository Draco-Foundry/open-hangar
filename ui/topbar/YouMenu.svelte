<script>
  // Your menu: your RSI portrait (a gear until we know who you are) opens it. Name and
  // org at the top, "Update ready: Reload" when a new version is waiting (a dot on the
  // portrait too), then Currency, Streamer Mode (a badge on the portrait while it's
  // on, #174), Rescan Reminder, RSI Quick Links (#374, folds open), the pages that
  // left the nav, Log Out of RSI and Clear Data. What each one does stays in dashboard.js (window.OHApp.top).
  import { app, version } from '../lib/app.svelte.js';
  import { menus, register, toggleMenu, menuClick } from './menus.svelte.js';
  import { quickLinks, QL_ICONS } from '../lib/quick-links.js';
  import { qlPref, setQuickLinksHidden } from '../lib/quick-links-pref.svelte.js';
  import QuickLinkRow from '../lib/QuickLinkRow.svelte';

  const CURRENCIES = [
    ['USD', 'USD $'],
    ['EUR', 'EUR €'],
    ['GBP', 'GBP £'],
    ['CAD', 'CAD $'],
    ['AUD', 'AUD $'],
    ['NZD', 'NZD $'],
    ['CHF', 'CHF'],
    ['SEK', 'SEK kr'],
    ['PLN', 'PLN zł'],
    ['CZK', 'CZK Kč'],
    ['BRL', 'BRL R$'],
    ['CNY', 'CNY ¥'],
    ['JPY', 'JPY ¥'],
    ['KRW', 'KRW ₩'],
  ];

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const bar = a.top.bar;
    const acc = a.account;
    const loggedIn = !!acc && acc.loggedIn === true;
    const org = acc?.org?.name ? `${acc.org.name}${acc.org.rank ? ` · ${acc.org.rank}` : ''}` : '';
    const s = a.state;
    const tip = a.streamer ? 'Your menu · Streamer Mode is on: money is hidden' : 'Your menu';
    return {
      tip,
      streamer: a.streamer,
      pic: loggedIn ? a.safeBgUrl(acc.avatar) : '',
      loggedIn,
      name: loggedIn ? acc.displayname || acc.nickname || '' : '',
      org,
      update: bar.update,
      currency: bar.currency,
      currencyTip: a.top.currencyNote || 'Show amounts in your currency (converted from USD)',
      remind: bar.remind,
      loggingOut: bar.loggingOut,
      hasData: !!(s.items.length || s.scannedAt),
      quick: quickLinks(acc?.nickname, { menu: true }),
    };
  });

  let btn = $state();
  let menu = $state();
  $effect(() => register('you', btn, menu));

  // Log Out of RSI and Clear Data ask once, right here (owner, 2026-10-05): the menu
  // stays open for the question, and opening it again starts fresh.
  let asking = $state(''); // '' | 'logout' | 'clear'
  let keepBtn = $state();
  $effect(() => {
    if (menus.open !== 'you') asking = '';
  });
  async function ask(e, what) {
    e.stopPropagation(); // a question, not an action: keep the menu open
    asking = what;
    await Promise.resolve();
    keepBtn?.focus({ preventScroll: true });
  }
  // Quick Links fold open and shut; shut each time the menu opens, so it stays short.
  let qlOpen = $state(false);
  $effect(() => {
    if (menus.open !== 'you') qlOpen = false;
  });

  function keep(e) {
    e.stopPropagation();
    asking = '';
  }
</script>

<div class="cc-settings">
  <button
    bind:this={btn}
    id="settings-btn"
    class="avatar-btn"
    type="button"
    aria-haspopup="true"
    aria-expanded={menus.open === 'you'}
    aria-label={d.tip}
    title={d.tip}
    onclick={(e) => toggleMenu('you', e)}
  >
    <span
      class="avatar-img"
      id="menu-avatar"
      class:has-pic={!!d.pic}
      style:background-image={d.pic || null}
      ><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.14 12.94a7.4 7.4 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0
            0-.6-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2.4h-3.8a.5.5 0 0
            0-.49.42l-.36 2.54a7 7 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.88a.5.5 0 0 0
            .12.64l2.03 1.58a7.4 7.4 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0
            0 .6.22l2.39-.96c.5.39 1.05.7 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0
            .49-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0
            0-.12-.64zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        /></svg
      ></span
    ><span class="upd-dot" id="upd-dot" hidden={!d.update}></span
    ><!-- Streamer Mode on: a badge on the portrait, not a pill in the bar, so the bar
         keeps one row (#174). -->
    <span class="stream-dot" id="stream-dot" hidden={!d.streamer}></span>
  </button>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menu}
    id="settings-menu"
    class="scan-menu settings-menu"
    hidden={menus.open !== 'you'}
    onclick={menuClick}
  >
    <div class="menu-who" id="menu-who" hidden={!d.loggedIn}>
      {#if d.loggedIn}
        <span class="mw-pic" style:background-image={d.pic || null}></span><span
          ><b>{d.name}</b>{#if d.org}<small>{d.org}</small>{/if}</span
        >
      {/if}
    </div>
    <div class="menu-upd" id="menu-upd" hidden={!d.update}>
      <span id="menu-upd-text">{d.update ? `Update ready: ${d.update}` : ''}</span><button
        type="button"
        id="menu-upd-reload"
        onclick={() => app().top.reload()}>Reload</button
      >
    </div>
    <!-- Language picker goes here once the dashboard is translated (TODO.md). -->
    <label class="scan-opt menu-currency"
      ><span>Currency</span>
      <select
        id="currency-select"
        class="currency-select"
        aria-label="Currency"
        title={d.currencyTip}
        value={d.currency}
        onchange={(e) => app().top.setCurrency(e.currentTarget.value)}
      >
        {#each CURRENCIES as [code, label] (code)}
          <option value={code}>{label}</option>
        {/each}
      </select>
    </label>
    <label
      class="scan-opt"
      title="Hides money amounts across Open Hangar, for streams and screenshots"
      ><span>Streamer Mode</span><input
        type="checkbox"
        id="streamer-toggle"
        checked={d.streamer}
        onchange={(e) => app().top.setStreamer(e.currentTarget.checked)}
      /></label
    >
    <label
      class="scan-opt"
      title="Shows an amber ! on the toolbar icon when your last scan is a week old"
      ><span>Rescan Reminder</span><input
        type="checkbox"
        id="remind-toggle"
        checked={d.remind}
        onchange={(e) => app().top.setRemind(e.currentTarget.checked)}
      /></label
    >
    <button
      type="button"
      class="ql-toggle"
      id="ql-toggle"
      class:open={qlOpen}
      aria-expanded={qlOpen}
      aria-controls="ql-menu"
      onclick={() => (qlOpen = !qlOpen)}
      ><svg
        class="ql-grid-ic"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">{@html QL_ICONS.grid}</svg
      >Quick Links<span class="ql-tag">RSI</span><span class="ql-chev" aria-hidden="true">›</span></button
    >
    <div class="ql-in" id="ql-menu" hidden={!qlOpen}>
      {#if qlPref.hidden}
        <button type="button" class="ql-show" id="ql-show" onclick={() => setQuickLinksHidden(false)}
          >Show on Home</button
        >
      {/if}
      {#each d.quick as g (g.name)}
        <p class="ql-grp">{g.name}</p>
        {#each g.links as l (l.t)}<QuickLinkRow link={l} />{/each}
      {/each}
    </div>
    <a class="menu-item menu-link" href="#guide" data-view="guide">How to Use</a>
    <a class="menu-item menu-link" href="#updates" data-view="updates">Updates</a>
    <a class="menu-item menu-link" href="#issues" data-view="issues">Known Issues</a>
    <a class="menu-item menu-link" href="#developers" data-view="developers">Developers</a>
    <!-- openhangar.space: Disconnect, once connected (ui/site/YouDisconnect.svelte). -->
    <div id="you-menu-site" style="display: contents"></div>
    {#if asking === 'logout'}
      <div class="sm-confirm you-confirm warn" role="group" aria-label="Log Out of RSI">
        <b>Log Out of RSI?</b>
        <span>Signs you out of robertsspaceindustries.com in this browser. Your saved data stays.</span>
        <div class="sm-confirm-row">
          <button bind:this={keepBtn} type="button" class="sc-btn" onclick={keep}
            >Stay Signed In</button
          >
          <button
            type="button"
            class="sc-btn warn menu-item"
            id="logout-confirm"
            onclick={() => ((asking = ''), app().top.logOut())}>Log Out</button
          >
        </div>
      </div>
    {:else}
      <button
        id="logout-home"
        class="menu-item menu-warn"
        type="button"
        hidden={!d.loggedIn}
        disabled={d.loggingOut}
        onclick={(e) => ask(e, 'logout')}
      >
        Log Out of RSI<small>For switching accounts. Your saved data stays.</small>
      </button>
    {/if}
    {#if asking === 'clear'}
      <div class="sm-confirm you-confirm danger" role="group" aria-label="Clear Data">
        <b>Clear This Account's Data?</b>
        <span
          >Removes this account's scans from this browser. Other saved accounts are kept, and you
          can scan again any time.</span
        >
        <div class="sm-confirm-row">
          <button bind:this={keepBtn} type="button" class="sc-btn" onclick={keep}>Keep Data</button>
          <button
            type="button"
            class="sc-btn danger menu-item"
            id="clear-confirm"
            onclick={() => ((asking = ''), app().top.clearData())}>Clear Data</button
          >
        </div>
      </div>
    {:else}
      <button
        id="clear-home"
        class="menu-item menu-danger"
        type="button"
        hidden={!d.hasData}
        onclick={(e) => ask(e, 'clear')}
      >
        Clear Data<small>Removes this account's scans from this browser.</small>
      </button>
    {/if}
  </div>
</div>

