<script>
  // For You: alerts only this extension can give, because only it sees your hangar.
  // Each has Ignore; an ignored alert stays hidden until something new happens (its
  // key changes). Nothing here nags about CCUs: players hoard them on purpose.
  //  - a wishlist ship on sale in RSI's store right now
  //  - a ship you own turned flight ready (shown for two weeks)
  //  - buy-backs that match ships on your wishlist
  //  - your enlistment anniversary (the week around it)
  // Renders nothing when there's nothing to say (the Citizen Card then spans the row).
  import { app, OH, version } from '../lib/app.svelte.js';

  const a = app();
  const store = chrome.storage.local;
  const READY_DAYS = 14;

  let ignored = $state(new Set());
  let ready = $state({}); // ship name → when we first saw it flight ready
  let onSale = $state([]); // [{ name, price }]
  let enlisted = $state(null);
  let lastIgnored = $state(null);
  store.get(['homeIgnored', 'homeReady']).then((r) => {
    ignored = new Set(r.homeIgnored || []);
    ready = r.homeReady || {};
  });
  OH()
    .getAccount()
    .then((acc) => {
      const t = acc && Date.parse(acc.enlistedSince);
      if (Number.isFinite(t)) enlisted = t;
    })
    .catch(() => {});

  // Owned ships' production state vs what we saw last time: a ship moving to
  // flight ready becomes an alert. The first run only records (no flood of alerts).
  $effect(() => {
    version.n;
    const s = a.state;
    if (!s.items.length || !s.shipOf) return;
    const now = {};
    for (const p of s.items) {
      if (!p.containsShip) continue;
      const v = a.shipOf(a.resolveImageName(p));
      if (v && v.status) now[v.name] = v.status;
    }
    store.get('homeShipStatus').then(({ homeShipStatus: before }) => {
      const nextReady = { ...ready };
      let changed = false;
      if (before) {
        for (const [name, st] of Object.entries(now)) {
          if (st === 'flight-ready' && before[name] && before[name] !== 'flight-ready' && !nextReady[name]) {
            nextReady[name] = Date.now();
            changed = true;
          }
        }
      }
      if (changed) {
        ready = nextReady;
        store.set({ homeReady: nextReady });
      }
      store.set({ homeShipStatus: now });
    });
  });

  // Wishlist ships in the store right now (reuses the Store page's cached check).
  $effect(() => {
    version.n;
    if (!a.state.wishlist.length) {
      onSale = [];
      return;
    }
    a.wishlistStock().then((list) => {
      onSale = list.filter((x) => x.st && x.st.state === 'in').map((x) => ({ name: x.name, price: x.st.price }));
    });
  });

  const alerts = $derived.by(() => {
    version.n;
    const s = a.state;
    const out = [];
    for (const x of onSale)
      out.push({
        key: `sale:${x.name}`,
        kind: 'onsale',
        icon: '$',
        title: `${x.name} is on sale`,
        sub: `From your wishlist${x.price ? ` · ${a.dollars(x.price)} in the store` : ''}`,
        href: '#store',
      });
    const cutoff = Date.now() - READY_DAYS * 864e5;
    for (const [name, at] of Object.entries(ready))
      if (at > cutoff)
        out.push({ key: `ready:${name}`, kind: 'good', icon: '↑', title: `${name} is flight ready`, sub: 'A ship you own changed status', href: '#inventory' });
    // Buy-backs of ships on your wishlist.
    const wish = new Set((s.wishlist || []).map((w) => String(w).toLowerCase()));
    const bb = (s.buybacks || []).filter((b) => {
      const v = a.shipOf(a.resolveImageName(b));
      return v && wish.has(String(v.name).toLowerCase());
    });
    if (bb.length)
      out.push({
        key: `bb:${bb.map((b) => b.id).sort().join(',')}`,
        kind: 'info',
        icon: '↺',
        title:
          bb.length === 1 ? '1 buy-back matches your wishlist' : `${bb.length} buy-backs match your wishlist`,
        sub: [...new Set(bb.map((b) => a.cardName(b)))].slice(0, 3).join(', '),
        href: '#buybacks',
      });
    if (enlisted) {
      const e = new Date(enlisted);
      const now = new Date();
      const years = now.getFullYear() - e.getFullYear();
      const anniv = new Date(now.getFullYear(), e.getMonth(), e.getDate()).getTime();
      if (years > 0 && Math.abs(Date.now() - anniv) <= 7 * 864e5)
        out.push({
          key: `enlist:${now.getFullYear()}`,
          kind: 'warn',
          icon: '★',
          title: `${years} year${years === 1 ? '' : 's'} since you enlisted`,
          sub: e.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        });
    }
    return out.filter((x) => !ignored.has(x.key));
  });

  function ignore(key) {
    const next = new Set(ignored);
    next.add(key);
    ignored = next;
    lastIgnored = key;
    store.set({ homeIgnored: [...next].slice(-200) });
  }
  function undo() {
    const next = new Set(ignored);
    next.delete(lastIgnored);
    ignored = next;
    lastIgnored = null;
    store.set({ homeIgnored: [...next] });
  }
</script>

{#if alerts.length || lastIgnored}
  <section class="oh-p fy-card">
    <div class="oh-ph">
      <h3>For You</h3>
      <span class="count">{alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : 'All caught up'}</span>
    </div>
    <div class="list">
      {#each alerts as x (x.key)}
        <div class="fy {x.kind}">
          <span class="ic" aria-hidden="true">{x.icon}</span>
          <a class="tx" href={x.href || undefined}>
            <span class="t" title={x.title}>{x.title}</span>
            <span class="s" title={x.sub}>{x.sub}</span>
          </a>
          <button type="button" class="ig" onclick={() => ignore(x.key)} aria-label="Ignore: {x.title}">Ignore</button>
        </div>
      {/each}
    </div>
    {#if lastIgnored}
      <p class="undo">Hidden. <button type="button" onclick={undo}>Undo</button></p>
    {/if}
  </section>
{/if}

<style>
  .fy-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .count {
    font-size: 13px;
    color: var(--muted);
  }
  .list {
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .fy {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    background: var(--panel-2);
    border-radius: 11px;
    padding: 9px 10px;
  }
  .fy.onsale {
    background: var(--good-soft);
  }
  .ic {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font: 800 13px var(--font-head);
    background: var(--accent-soft);
    color: var(--link);
  }
  .onsale .ic,
  .good .ic {
    background: var(--good-soft);
    color: var(--good);
  }
  .warn .ic {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .tx {
    min-width: 0;
    display: grid;
    text-decoration: none;
    color: inherit;
  }
  /* The card is a quarter of the row: titles wrap to two lines instead of cutting off. */
  .t {
    font-weight: 600;
    color: var(--head);
    font-size: 14px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tx:hover .t {
    color: var(--link);
  }
  .s {
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ig,
  .undo button {
    border: 1px solid var(--line-2);
    background: none;
    border-radius: 8px;
    padding: 3px 9px;
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
  }
  .ig:hover,
  .undo button:hover {
    color: var(--head);
  }
  .undo {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
