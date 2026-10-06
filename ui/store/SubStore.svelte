<script>
  // Your Subscriber Store (#418): the subscriber-only items RSI offers the signed-in
  // account, read by lib.js (OH.getSubStore) at most once a day plus Refresh. The
  // list is exactly what RSI returns for this session; a tier chip only repeats
  // what an item's own tags or label say. Cards: picture, chips, name, price, and
  // Buy at RSI only while RSI has it in stock (otherwise Sold Out).
  import { app, version } from '../lib/app.svelte.js';
  import { daysAgo } from '../lib/format.js';

  const PLANS = 'https://robertsspaceindustries.com/en/pledge/subscriptions';
  const STEP = 60; // cards drawn at a time
  const KINDS = [
    'Paints',
    'Armor',
    'Weapons',
    'Clothing',
    'Flair',
    'Kits and Bundles',
    'Ships',
    'Other',
  ];

  let q = $state('');
  let kind = $state('All');
  let limit = $state(STEP);

  const d = $derived.by(() => {
    version.n;
    const a = app();
    if (!a.store.active) return null;
    const sub = a.store.sub;
    const acct = sub.account;
    if (!acct) return { state: 'wait' };
    if (acct.loggedIn !== true) return { state: 'out' };
    if (!(acct.subscriber && acct.subscriber.type)) return { state: 'plans' };
    const list = sub.list;
    const items = (list && list.items) || [];
    // Shelves that have something on them, in a fixed order, Other last.
    const counts = new Map();
    for (const it of items) counts.set(it.kind, (counts.get(it.kind) || 0) + 1);
    const rank = (k) => (KINDS.includes(k) ? KINDS.indexOf(k) : KINDS.length);
    const kinds = [...counts.keys()].sort((x, y) => rank(x) - rank(y));
    const needle = q.trim().toLowerCase();
    const hits = items.filter(
      (it) =>
        (kind === 'All' || it.kind === kind) &&
        (!needle ||
          [it.name, it.sub || '', ...(it.tags || [])].join(' ').toLowerCase().includes(needle)),
    );
    return {
      state: 'list',
      loading: sub.loading,
      done: sub.done,
      total: sub.total,
      error: sub.error,
      has: !!list,
      count: items.length,
      rsiTotal: list ? list.total : null,
      partial: !!(list && list.partial),
      when: list && list.at ? daysAgo(list.at) : '',
      kinds: kinds.length > 1 ? kinds.map((k) => ({ k, n: counts.get(k) })) : [],
      hits: hits.slice(0, limit).map((it) => ({
        ...it,
        priceText:
          it.price == null ? '' : it.price === 0 ? 'Free' : a.money(it.price),
        wasText: it.was ? a.money(it.was) : '',
      })),
      more: Math.max(0, hits.length - limit),
      found: hits.length,
    };
  });

  const ERR = {
    refused: 'RSI asked for a fresh login. Sign in on robertsspaceindustries.com, then press Refresh.',
    busy: 'RSI’s store is catching its breath. Press Refresh in a few minutes.',
    network: 'Couldn’t reach RSI’s store this time. Press Refresh to try again.',
  };
  const errText = (e) => ERR[e] || ERR.network;

  function pick(k) {
    kind = k;
    limit = STEP;
  }
</script>

<div class="store-panel sub-store" id="sub-store">
  <div class="sp-head">
    <h3>
      Your Subscriber Store
      {#if d && d.state === 'list' && d.has}<span class="market-n" id="sub-n">{d.count}</span>{/if}
    </h3>
    {#if d && d.state === 'list'}
      <input
        id="sub-search"
        type="search"
        placeholder="Search your Subscriber Store…"
        autocomplete="off"
        aria-label="Search your Subscriber Store"
        bind:value={q}
        oninput={() => (limit = STEP)}
        onkeydown={(e) => e.key === 'Escape' && (q = '')}
      />
      <button
        type="button"
        class="btn sub-refresh"
        id="sub-refresh"
        disabled={d.loading}
        onclick={() => app().store.refreshSub()}>{d.loading ? 'Refreshing…' : 'Refresh'}</button
      >
    {/if}
  </div>

  {#if !d || d.state === 'wait'}
    <p class="muted sp-empty">Checking your subscription…</p>
  {:else if d.state === 'out'}
    <p class="muted sp-empty">Log in to RSI and your Subscriber Store shows up here.</p>
  {:else if d.state === 'plans'}
    <p class="muted sp-empty sub-plans">
      Subscribers get their own store each month.
      <a href={PLANS} target="_blank" rel="noopener">See Plans ↗</a>
    </p>
  {:else}
    {#if d.has}
      <p class="sp-count sub-meta" id="sub-meta">
        {d.count.toLocaleString('en-US')} item{d.count === 1 ? '' : 's'}, refreshed {d.when}{#if d.partial && d.rsiTotal > d.count}
          (RSI sent {d.count} of {d.rsiTotal}; Refresh for the rest){/if}
      </p>
    {/if}
    {#if d.loading}
      <p class="muted sp-empty" role="status">
        Opening the Subscriber Store…{#if d.total}
          {d.done} of {d.total}{/if}
      </p>
    {:else if d.error}
      <p class="muted sp-empty sub-error" role="status">{errText(d.error)}</p>
    {/if}

    {#if d.has && d.count === 0}
      <p class="muted sp-empty">Nothing on the shelves right now. Check back next month, citizen.</p>
    {:else if d.has}
      {#if d.kinds.length}
        <div class="chip-row sub-kinds" role="group" aria-label="Item types">
          <button type="button" class="chip" aria-pressed={kind === 'All'} onclick={() => pick('All')}
            >All <span class="n">{d.count}</span></button
          >
          {#each d.kinds as c (c.k)}
            <button type="button" class="chip" aria-pressed={kind === c.k} onclick={() => pick(c.k)}
              >{c.k} <span class="n">{c.n}</span></button
            >
          {/each}
        </div>
      {/if}
      {#if !d.found}
        <p class="muted sp-empty">Nothing by that name in your Subscriber Store.</p>
      {:else}
        <div class="sub-scroll">
          <ul class="sub-grid" id="sub-grid">
            {#each d.hits as it (it.id)}
              <li class="sub-card" data-sub-id={it.id}>
                <div class="sub-pic">
                  {#if it.img}
                    <img src={it.img} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
                  {/if}
                </div>
                <div class="sub-body">
                  <div class="sub-chips">
                    <span class="sub-kind">{it.kind}</span>
                    {#if it.warbond}<span class="sub-chip wb">Warbond</span>{/if}
                    {#each it.tiers as t (t)}<span class="sub-chip tier">{t}</span>{/each}
                  </div>
                  <p class="sub-name" title={it.name}>{it.name}</p>
                  <div class="sub-foot">
                    <span class="sub-price"
                      >{#if it.priceText}{it.priceText}{:else}<span class="muted">—</span>{/if}{#if it.wasText}{' '}<s class="muted" title="Before the sale">{it.wasText}</s
                      >{/if}</span
                    >
                    {#if it.available && it.url}
                      <a class="btn sub-buy" href={it.url} target="_blank" rel="noopener">Buy at RSI ↗</a>
                    {:else}
                      <span class="sub-out">Sold Out</span>
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ul>
          {#if d.more}
            <button type="button" class="btn sub-more" onclick={() => (limit += STEP)}
              >Show More <span class="muted">({d.more} left)</span></button
            >
          {/if}
        </div>
      {/if}
    {/if}
    <p class="muted value-note sub-note">What RSI shows your account today.</p>
  {/if}
</div>

<style>
  .sub-plans a,
  .sub-buy {
    white-space: nowrap;
  }
  .sub-refresh {
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 500;
  }
  .sub-meta {
    margin: -4px 0 10px;
  }
  .sub-kinds {
    margin: 0 0 12px;
  }
  .sub-scroll {
    max-height: 640px;
    overflow: auto;
    border-radius: var(--r-sm, 8px);
  }
  .sub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .sub-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--r-md, 10px);
    background: var(--panel-2);
  }
  .sub-pic {
    aspect-ratio: 16 / 9;
    background: var(--panel);
  }
  .sub-pic img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sub-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px 10px;
  }
  /* Every card in a row lines up: one chip line, a two-line slot for the name,
     price and Buy pinned to the bottom. */
  .sub-chips {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    min-height: 18px;
    overflow: hidden;
  }
  .sub-chip {
    flex: none;
  }
  .sub-kind {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub-kind,
  .sub-chip {
    padding: 1px 6px;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .sub-chip.wb {
    border-color: currentColor;
    color: var(--beacon, var(--t-pack));
  }
  .sub-chip.tier {
    border-color: currentColor;
    color: var(--accent);
  }
  .sub-name {
    display: -webkit-box;
    flex: none;
    min-height: calc(2em * 1.3);
    margin: 0;
    overflow: hidden;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    text-wrap: balance;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .sub-foot {
    display: flex;
    min-height: 26px; /* a Buy button's height, so Sold Out sits on the same line */
    margin-top: auto;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sub-price {
    font-family: var(--font-data, inherit);
    font-weight: 600;
    white-space: nowrap;
  }
  .sub-price s {
    font-size: 11px;
    font-weight: 400;
  }
  .sub-buy {
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
  }
  .sub-out {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  .sub-more {
    display: block;
    margin: 12px auto 2px;
    font-weight: 500;
  }
  .sub-note {
    margin: 10px 2px 0;
  }
</style>
