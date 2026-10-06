<script>
  // Hangar Alerts (was "For You"): alerts only this extension can give, because only it sees your hangar.
  // Each has Ignore; an ignored alert stays hidden until something new happens (its
  // key changes). Nothing here nags about CCUs: players hoard them on purpose.
  //  - a wishlist ship on sale in RSI's store right now
  //  - a ship you own turned flight ready (shown for two weeks)
  //  - buy-backs that match ships on your wishlist
  //  - your enlistment anniversary (the week around it)
  // Works the list out and hands it to the top bar's bell (it has no markup of its own).
  import { app, OH, version } from '../lib/app.svelte.js';

  const a = app();
  const store = chrome.storage.local;
  const READY_DAYS = 14;

  let ignored = $state(new Set());
  let ready = $state({}); // ship name → when we first saw it flight ready
  let enlisted = $state(null);
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

  // Wishlist ships on sale at the last wishlist check (Check Now on Home's Wishlist
  // Watch, or Scan → Store). Nothing asks RSI's store by itself.
  const onSale = $derived.by(() => {
    version.n;
    if (!a.state.wishlist.length) return [];
    return a.store
      .wishWatchRows()
      .filter((x) => x.status === 'in')
      .map((x) => ({ name: x.name, price: x.price }));
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
    store.set({ homeIgnored: [...next].slice(-200) });
  }
</script>

<!-- No markup: Hangar Alerts show in the top bar's bell (dashboard.js renderBell). -->
