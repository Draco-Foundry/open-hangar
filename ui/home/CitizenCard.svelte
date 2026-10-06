<script>
  // Citizen Card ("Pilot ID", signed off 2026-09-30): portrait down the left (RSI's
  // 1024px original, the 165px thumbnail underneath as a fallback; initials when
  // there's no portrait), then name, main org, the UEE line, Subscriber / Chairman's
  // Club and the wallet, over a faint org-logo watermark. No controls: Scan and the
  // gear menu live in the top bar. Hidden while signed out (SignedOut.svelte shows).
  // The account comes from renderAccount() in src/dashboard.js (OHApp.account).
  import { app, version } from '../lib/app.svelte.js';

  const DASH = '—'; // placeholder for missing data, as on the classic pages
  const RSI = 'https://robertsspaceindustries.com';

  // What each subscription gives (RSI's subscription plans page; static text).
  const SUB_PERKS = {
    centurion: {
      perks: [
        ['1x', 'Vehicle of the Month'],
        ['1x', 'Subscriber Flair'],
        ['20,000', 'REC a month'],
        ['10%', 'off coupons'],
      ],
      extra: '10% off merch, ',
    },
    imperator: {
      perks: [
        ['2x', 'Vehicle of the Month'],
        ['2x', 'Subscriber Flair'],
        ['40,000', 'REC a month'],
        ['20%', 'off coupons'],
      ],
      extra: '15% off merch, Imperator Test Flight, ',
    },
  };
  // Chairman's Club levels and the rewards each adds (RSI support article "Concierge
  // Levels and Rewards"; static text). RSI's own progress figure comes from the account.
  const LADDER = [
    ['High Admiral', '$1,000', 'Jacopo Top Hat and Monocle, Radegast Whiskey 2947, Arclight II Executive Edition, a soundtrack sample and the Star Citizen Digital Download.'],
    ['Grand Admiral', '$2,500', 'Arrowhead Sniper Rifle Executive Edition.'],
    ['Space Marshal', '$5,000', 'Venture Explorer Suit Executive Edition.'],
    ['Wing Commander', '$10,000', 'Anvil F8C Lightning with the Shock Wave paint.'],
    ['Praetorian', '$15,000', 'Two Havoc Scatterguns (Sharkmouth) and the F8C Lightning Executive Edition.'],
    ['Legatus Navium', '$25,000', 'Origin 600i Executive Edition.'],
  ];
  const step = (name) => {
    const i = LADDER.findIndex(([n]) => n.toLowerCase() === String(name || '').toLowerCase());
    return i < 0 ? null : { i, name: LADDER[i][0], spend: LADDER[i][1], rewards: LADDER[i][2] };
  };
  function concierge(c, color) {
    const cur = step(c.level);
    const next = c.next ? step(c.next) || { name: c.next } : null;
    const pct = c.percent == null || c.percent === '' ? null : Number(c.percent);
    return {
      level: c.level,
      color: color(c.level),
      nextColor: next ? color(next.name) : null,
      cur,
      next,
      pct: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : null,
    };
  }

  // The two popups: closed at first, one open at a time (the top bar's menus close
  // too), Escape or a click elsewhere closes them and focus goes back to the button.
  let pop = $state(null); // 'sub' | 'con' | null
  let popPos = $state({ left: 0, top: 0 });
  const btns = {};
  let popEl = $state();
  function toggle(which, e) {
    e.stopPropagation();
    if (pop === which) return close();
    document.dispatchEvent(new CustomEvent('oh:close-menus'));
    const b = btns[which].getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 16);
    popPos = { left: Math.max(8, Math.min(b.left - 6, window.innerWidth - w - 8)), top: b.bottom + 10 };
    pop = which;
    requestAnimationFrame(() => popEl?.focus({ preventScroll: true }));
  }
  function close(refocus = false) {
    if (!pop) return;
    const was = pop;
    pop = null;
    if (refocus) btns[was]?.focus({ preventScroll: true });
  }
  $effect(() => {
    const outside = (e) => {
      if (pop && !e.target.closest?.('.cc-pop')) close();
    };
    const key = (e) => {
      if (e.key === 'Escape' && pop) close(true);
    };
    const quiet = () => close();
    document.addEventListener('click', outside);
    document.addEventListener('keydown', key);
    document.addEventListener('oh:close-popups', quiet);
    window.addEventListener('resize', quiet);
    window.addEventListener('scroll', quiet, { passive: true });
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', key);
      document.removeEventListener('oh:close-popups', quiet);
      window.removeEventListener('resize', quiet);
      window.removeEventListener('scroll', quiet);
    };
  });
  function toSubStore(e) {
    e.preventDefault();
    close();
    location.hash = '#store';
    setTimeout(() => document.getElementById('sub-store')?.scrollIntoView({ block: 'start' }), 350);
  }

  const d = $derived.by(() => {
    version.n;
    const ohApp = app();
    const a = ohApp.account;
    if (!a)
      return { shown: true, loaded: false, name: 'Open Hangar', meta: [], flair: [], wallet: null };
    const handle = a.nickname || '';
    const citizenUrl = handle ? `${RSI}/citizens/${encodeURIComponent(handle)}` : null;

    // Portrait: the 1024px original next to the thumbnail RSI's account page links.
    const thumb = ohApp.safeBgUrl(a.avatar);
    const big = /\/heap_infobox\//.test(a.avatar || '')
      ? ohApp.safeBgUrl(a.avatar.replace('/heap_infobox/', '/source/'))
      : '';
    const nm = a.displayname || a.nickname || '';
    const initials = thumb
      ? ''
      : nm
          .split(/[\s_-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join('');

    // UEE record · Est. <month year> · <n> years (full date on hover).
    const meta = [];
    if (a.loggedIn) {
      if (a.citizenRecord) meta.push({ text: `UEE ${a.citizenRecord}` });
      const dt = a.enlistedSince ? new Date(a.enlistedSince) : null;
      if (dt && !isNaN(dt.getTime())) {
        const my = dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        meta.push({ text: `Est. ${my}`, title: `Enlisted ${ohApp.fmtEnlisted(a.enlistedSince)}` });
        const now = new Date();
        let yrs = now.getFullYear() - dt.getFullYear();
        if (
          now.getMonth() < dt.getMonth() ||
          (now.getMonth() === dt.getMonth() && now.getDate() < dt.getDate())
        )
          yrs--;
        if (yrs >= 1) meta.push({ text: `${yrs} year${yrs === 1 ? '' : 's'}` });
      }
    }

    // Main org only. No org, or a hidden/redacted one: nothing at all.
    const org = a.loggedIn && a.org && a.org.name ? a.org : null;

    // Subscriber and Chairman's Club, one line each; each only when it applies and
    // each opens its popup.
    const sub = a.subscriber?.type ? a.subscriber : null;
    const con = a.concierge?.level ? a.concierge : null;

    // Wallet: Store Credit, UEC, REC, Buy-Back Tokens. Big amounts are shortened
    // (¤ 1.2M) with the exact figure on hover; Streamer Mode turns them into dots.
    const c = a.credits || {};
    const fmt = (n) => Number(n).toLocaleString('en-US');
    // A no-break space after ¤ so the symbol doesn't crowd the digits.
    const aUEC = (x) =>
      !x
        ? { val: DASH }
        : ohApp.streamer
          ? { val: '••••' }
          : { val: '¤\u00a0' + ohApp.compactNum(x.value), full: '¤\u00a0' + fmt(x.value) };
    const store = c.store ? c.store.value / 100 : null;
    const tip = (t) => (t.full && t.full !== t.val ? t.full : undefined);
    const tiles = [
      {
        cls: 'store',
        label: 'Store Credit',
        ...(store != null
          ? { val: ohApp.shortMoney(store), full: ohApp.money(store) }
          : { val: DASH }),
      },
      { cls: 'uec', label: 'UEC', ...aUEC(c.uec) },
      { cls: 'rec', label: 'REC', ...aUEC(c.rec) },
    ].map((t) => ({ ...t, title: tip(t) }));

    return {
      shown: a.loggedIn === true,
      loaded: true,
      citizenUrl,
      avatarBg: [big, thumb].filter(Boolean).join(', '),
      initials,
      name: nm || (a.loggedIn === false ? 'Not signed in' : DASH),
      meta,
      org,
      sub: sub
        ? {
            type: sub.type,
            freq: sub.frequency ? ohApp.titleCase(String(sub.frequency)) : '',
            ...(SUB_PERKS[String(sub.type).toLowerCase()] || {}),
          }
        : null,
      con: con ? concierge(con, ohApp.conciergeColor) : null,
      wallet: {
        tiles,
        tokens: ohApp.state.bbTokens != null ? ohApp.state.bbTokens : DASH,
        tokenTitle: ohApp.tokenTitle(),
      },
    };
  });
</script>

<div class="cc-account" id="cc-account" hidden={!d.shown}>
  <a
    class="cc-photo"
    id="cc-photo"
    href={d.citizenUrl || undefined}
    title={d.citizenUrl ? 'Open your RSI citizen page' : undefined}
    target="_blank"
    rel="noopener"
    aria-label="Open Your RSI Citizen Page"
    ><span class="cc-avatar" id="cc-avatar" style:background-image={d.avatarBg || undefined}
      >{d.initials || ''}</span
    ></a
  >
  <img
    class="cc-water"
    id="cc-water"
    alt=""
    src={d.org?.logo || undefined}
    hidden={!d.org?.logo}
  />
  <div class="cc-info">
    <div class="cc-name" id="cc-name">
      {#if d.citizenUrl}<a
          class="cc-plain"
          href={d.citizenUrl}
          target="_blank"
          rel="noopener"
          title="Open your RSI citizen page">{d.name}</a
        >{:else}{d.name}{/if}
    </div>
    <div class="cc-org" id="cc-org" hidden={!d.org}>
      {#if d.org}
        {#snippet orgInner()}{#if d.org.logo}<img
              class="cc-org-logo"
              src={d.org.logo}
              alt=""
              loading="lazy"
            />{/if}<span class="cc-org-text"
            ><span class="cc-org-name">{d.org.name}</span>{#if d.org.rank}<span
                class="cc-org-rank">{d.org.rank}</span
              >{/if}</span
          >{/snippet}
        {#if d.org.sid}
          <a
            class="cc-org-link"
            href="{RSI}/orgs/{encodeURIComponent(d.org.sid)}"
            target="_blank"
            rel="noopener"
            title="Open {d.org.name} on RSI">{@render orgInner()}</a
          >
        {:else}
          <span class="cc-org-link">{@render orgInner()}</span>
        {/if}
      {/if}
    </div>
    <div class="cc-meta" id="cc-meta">
      {#each d.meta as m, i}{#if i}{' · '}{/if}{#if m.title}<span title={m.title}>{m.text}</span
          >{:else}{m.text}{/if}{/each}
    </div>
    <div class="home-flair" id="home-flair" hidden={d.loaded && !d.sub && !d.con}>
      {#if d.sub}<button
          type="button"
          class="flair sub"
          id="flair-sub"
          bind:this={btns.sub}
          aria-haspopup="dialog"
          aria-expanded={pop === 'sub'}
          aria-controls="cc-pop-sub"
          onclick={(e) => toggle('sub', e)}
          ><span class="flair-lbl">Subscriber</span> <b>{d.sub.type}</b><svg class="chev" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"
            ><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" /></svg
          ></button
        >{/if}
      {#if d.con}<button
          type="button"
          class="flair concierge"
          id="flair-con"
          bind:this={btns.con}
          aria-haspopup="dialog"
          aria-expanded={pop === 'con'}
          aria-controls="cc-pop-con"
          onclick={(e) => toggle('con', e)}
          ><span class="flair-lbl">Chairman's Club</span> <b style:color={d.con.color}>{d.con.level}</b><svg class="chev" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"
            ><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" /></svg
          ></button
        >{/if}
    </div>
    {#if pop === 'sub' && d.sub}
      <div
        class="cc-pop"
        id="cc-pop-sub"
        role="dialog"
        tabindex="-1"
        aria-labelledby="cc-pop-sub-h"
        bind:this={popEl}
        style:left="{popPos.left}px"
        style:top="{popPos.top}px"
      >
        <div class="pp-h"><h3 id="cc-pop-sub-h">Your Subscription</h3><button type="button" class="pp-x" aria-label="Close" onclick={() => close(true)}>✕</button></div>
        <div class="pp-tier"><span class="tier">{d.sub.type}</span>{#if d.sub.freq}<span class="pp-muted">{d.sub.freq}</span>{/if}</div>
        {#if d.sub.perks}
          <div class="perks">
            {#each d.sub.perks as [n, what] (what)}<div><b>{n}</b><span>{what}</span></div>{/each}
          </div>
          <p class="pp-muted pp-plus">Plus {d.sub.extra}Jump Point, The Vault, the Subscriber Den, early PTU access and event tickets.</p>
        {/if}
        <div class="pp-links">
          <a href="#store" onclick={toSubStore}>Your Subscriber Store →</a>
          <a href="{RSI}/en/pledge/subscriptions" target="_blank" rel="noopener">Manage ↗</a>
        </div>
      </div>
    {/if}
    {#if pop === 'con' && d.con}
      <div
        class="cc-pop"
        id="cc-pop-con"
        role="dialog"
        tabindex="-1"
        aria-labelledby="cc-pop-con-h"
        bind:this={popEl}
        style:left="{popPos.left}px"
        style:top="{popPos.top}px"
      >
        <div class="pp-h"><h3 id="cc-pop-con-h">Chairman's Club</h3><button type="button" class="pp-x" aria-label="Close" onclick={() => close(true)}>✕</button></div>
        <div class="pp-lvl">
          <span class="lvl" style:color={d.con.color}>{d.con.level}</span>
          {#if d.con.next}<span class="pp-muted">Next: <b style:color={d.con.nextColor}>{d.con.next.name}</b></span>{/if}
        </div>
        {#if d.con.next && d.con.pct != null}
          <div class="pp-prog">
            <span class="track" role="progressbar" aria-valuenow={d.con.pct} aria-valuemin="0" aria-valuemax="100" aria-label="Progress to {d.con.next.name}"
              ><i style:width="{d.con.pct}%"></i></span
            >
            <span><b>{d.con.pct}%</b> to {d.con.next.name}, per RSI</span>
          </div>
        {/if}
        {#if d.con.cur}
          <div class="ladder" aria-hidden="true">
            {#each LADDER as [n], i (n)}<i class:done={i < d.con.cur.i} class:cur={i === d.con.cur.i}></i>{/each}
          </div>
          <div class="ladder-l"><span>High Admiral</span><span>Level {d.con.cur.i + 1} of 6</span><span>Legatus Navium</span></div>
          <div class="rw"><b>Your Level: {d.con.cur.name} <span class="pp-muted">{d.con.cur.spend}</span></b>{d.con.cur.rewards}</div>
        {/if}
        {#if d.con.next?.rewards}
          <div class="rw"><b>Next: {d.con.next.name} <span class="pp-muted">{d.con.next.spend}</span></b>{d.con.next.rewards}</div>
        {/if}
        <p class="pp-src">Source: RSI Concierge Levels and Rewards</p>
        <div class="pp-links"><a href="{RSI}/en/account/concierge" target="_blank" rel="noopener">Your Concierge Page ↗</a></div>
      </div>
    {/if}
    <div class="home-balances" id="home-balances">
      {#if d.wallet}
        {#each d.wallet.tiles as t}<span class="bal {t.cls}" title={t.title}
            ><span class="bal-lbl">{t.label}</span><b>{t.val}</b></span
          >{/each}<a
          class="bal bbt"
          href="#buybacks"
          data-view="buybacks"
          title={d.wallet.tokenTitle}
          ><span class="bal-lbl">Buy-Back Tokens</span><b>{d.wallet.tokens}</b></a
        >
      {/if}
    </div>
  </div>
</div>

<style>
  .flair {
    cursor: pointer;
    font: inherit;
  }
  .flair .chev {
    color: var(--muted);
    margin-left: -2px;
  }
  .flair[aria-expanded='true'] b {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .flair:focus-visible {
    outline: 2px solid var(--accent-line);
    outline-offset: 3px;
    border-radius: 4px;
  }
  .cc-pop {
    outline: none;
    position: fixed;
    z-index: 70;
    width: 340px;
    max-width: calc(100vw - 16px);
    padding: 16px 18px;
    border-radius: var(--r-lg);
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
    color: var(--text);
    font-size: 13.5px;
    text-align: left;
  }
  .pp-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .pp-h h3 {
    margin: 0;
    font: 600 16px var(--font-head);
    color: var(--head);
  }
  .pp-x {
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 15px;
    cursor: pointer;
  }
  .pp-muted {
    color: var(--muted);
    font-weight: 400;
  }
  .pp-tier {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .tier {
    font: 600 13px var(--font-head);
    color: #f0b429;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--beacon-soft);
  }
  .perks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .perks div {
    display: grid;
    gap: 1px;
    padding: 7px 10px;
    border-radius: var(--r-sm);
    background: var(--panel);
  }
  .perks b {
    font: 600 14px var(--font-head);
    color: var(--head);
  }
  .perks span {
    font-size: 12px;
    color: var(--muted);
  }
  .pp-plus {
    margin: 8px 0 0;
    font-size: 12.5px;
    text-wrap: pretty;
  }
  .pp-links {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
    font: 600 13.5px var(--font-body);
  }
  .pp-links a {
    color: var(--link);
    text-decoration: none;
  }
  .pp-links a:hover {
    text-decoration: underline;
  }
  .pp-lvl {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .lvl {
    font: 600 18px var(--font-head);
  }
  .pp-prog {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    font-size: 12.5px;
    color: var(--muted);
    white-space: nowrap;
  }
  .pp-prog b {
    color: var(--head);
    font-weight: 600;
  }
  .track {
    flex: 1;
    height: 6px;
    border-radius: 99px;
    background: var(--line-2);
    overflow: hidden;
  }
  .track i {
    display: block;
    height: 100%;
    background: #9b7bff;
  }
  .ladder {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
    margin: 12px 0 4px;
  }
  .ladder i {
    height: 6px;
    border-radius: 99px;
    background: var(--line-2);
  }
  .ladder i.done {
    background: #9b7bff;
    opacity: 0.55;
  }
  .ladder i.cur {
    background: #9b7bff;
  }
  .ladder-l {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: var(--muted);
  }
  .rw {
    margin-top: 10px;
    padding: 9px 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--line);
    font-size: 12.5px;
    color: var(--muted);
    text-wrap: pretty;
  }
  .rw b {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
    font: 600 13px var(--font-head);
    color: var(--head);
  }
  .pp-src {
    margin: 8px 0 0;
    font-size: 11.5px;
    color: var(--faint);
  }
</style>
