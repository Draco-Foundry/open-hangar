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

    // Subscriber + Chairman's Club on one line; each only when it applies.
    const flair = [];
    if (a.subscriber?.type)
      flair.push({
        cls: 'sub',
        href: `${RSI}/en/pledge/subscriptions`,
        label: 'Subscriber',
        value: a.subscriber.type,
      });
    if (a.concierge?.level)
      flair.push({
        cls: 'concierge',
        href: `${RSI}/en/account/concierge`,
        label: "Chairman's Club",
        value: a.concierge.level,
        color: ohApp.conciergeColor(a.concierge.level),
        title: a.concierge.next
          ? `${Number(a.concierge.percent) || 0}% of the way to ${a.concierge.next}`
          : undefined,
      });

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
      flair,
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
    <div class="home-flair" id="home-flair" hidden={d.loaded && !d.flair.length}>
      {#each d.flair as f}<a
          class="flair {f.cls}"
          href={f.href}
          target="_blank"
          rel="noopener"
          title={f.title}
          ><span class="flair-lbl">{f.label}</span>
          <b style:color={f.color}>{f.value}</b></a
        >{/each}
    </div>
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
