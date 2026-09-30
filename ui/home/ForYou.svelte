<script>
  // Hangar Alerts (was "For You"): alerts only this extension can give, because only it sees your hangar.
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
        title: `${x.name} is on sale`,
        sub: x.price ? `${a.dollars(x.price)} in the store` : 'In the store now',
        href: '#store',
      });
    const cutoff = Date.now() - READY_DAYS * 864e5;
    for (const [name, at] of Object.entries(ready))
      if (at > cutoff)
        out.push({ key: `ready:${name}`, kind: 'good', title: `${name} is flight ready`, sub: 'A ship you own', href: '#inventory' });
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
        // Opens Buy-Backs showing just these, not all of them.
        go: () => a.showBuybacks(bb.map((b) => b.id), bb.length === 1 ? 'buy-back that matches your wishlist' : 'buy-backs that match your wishlist'),
        title: bb.length === 1 ? 'A wishlist ship to buy back' : `${bb.length} wishlist ships to buy back`,
        sub: (() => {
          const names = [...new Set(bb.map((b) => a.shipOf(a.resolveImageName(b)).name))];
          return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2} more` : '');
        })(),
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
          title: `${years} year${years === 1 ? '' : 's'} since you enlisted`,
          sub: e.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        });
    }
    return out.filter((x) => !ignored.has(x.key));
  });

  // The top bar's bell shows these same alerts on every page (dashboard.js renderBell).
  $effect(() => {
    const list = alerts.map((x) => ({ ...x }));
    window.OHApp.alerts = { list, ignore };
    document.dispatchEvent(new CustomEvent('oh:alerts'));
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
      <h3>Hangar Alerts</h3>
      <span class="count">{alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : 'All caught up'}</span>
    </div>
    <div class="list">
      {#each alerts as x (x.key)}
        <div class="fy {x.kind}">
          <a
            class="tx"
            href={x.href || undefined}
            onclick={x.go
              ? (e) => {
                  e.preventDefault();
                  x.go();
                }
              : undefined}
          >
            <span class="t" title={x.title}>{x.title}</span>
            <span class="s" title={x.sub}>{x.sub}</span>
          </a>
          <button type="button" class="ig" onclick={() => ignore(x.key)} title="Ignore" aria-label="Ignore: {x.title}">×</button>
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
    align-content: start;
  }
  /* One plain row per alert: a thin colour edge says what kind it is. */
  .fy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 10px 0 10px 12px;
    border-left: 3px solid var(--accent);
  }
  .fy + .fy {
    margin-top: 8px;
  }
  .fy.onsale,
  .fy.good {
    border-left-color: var(--good);
  }
  .fy.warn {
    border-left-color: var(--warn);
  }
  .tx {
    min-width: 0;
    display: grid;
    gap: 2px;
    text-decoration: none;
    color: inherit;
  }
  .t {
    font: 700 14px/1.3 var(--font-head);
    color: var(--head);
  }
  .tx:hover .t {
    color: var(--link);
  }
  .s {
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ig {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--faint);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .ig:hover {
    background: var(--panel-2);
    color: var(--head);
  }
  .undo button {
    border: 1px solid var(--line-2);
    background: none;
    border-radius: 8px;
    padding: 3px 9px;
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
  }
  .undo button:hover {
    color: var(--head);
  }
  .undo {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
