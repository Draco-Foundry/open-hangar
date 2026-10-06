<script>
  // Wishlist: one row per ship; its buy-backs (standalone copies, and CCUs that
  // upgrade to it) open underneath with dates, pledge IDs and Reclaim links.
  // "In Store Now" asks each ship's own store page (through the classic
  // checkStock(), which fires 'oh:home' as answers come in). Removing a ship and
  // its Undo bar go through the classic [data-wish-remove] / [data-wish-undo]
  // handlers.
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { app, version } from '../lib/app.svelte.js';
  import ShipLink from './ShipLink.svelte';

  const s = app().store;
  // Ships and packs first, then CCUs; newest melt first within each.
  const bbRank = (b) => (b.ccu ? 2 : b.kind === 'ship' ? 0 : 1);
  const bbType = (b) =>
    b.ccu ? 'CCU' : b.kind === 'package' ? 'Package' : b.kind === 'pack' ? 'Pack' : 'Ship';
  const plural = (n, w) => (n ? `${n} ${w}${n === 1 ? '' : 's'}` : '');

  const d = $derived.by(() => {
    version.n;
    const a = app();
    if (!s.active) return null;
    const st = a.state;
    const owned = new Map(s.ownedShips().map((x) => [s.shipKey(x.label), x.pledges.length]));
    const keys = new Set();
    const rows = s.wishlistOrder().map((name) => {
      const v = s.shipEntry(name);
      const title = (v && v.name) || name;
      const bbs = st.buybacks
        .filter((b) => s.buybackHasShip(b, title))
        .sort(
          (x, y) =>
            bbRank(x) - bbRank(y) || String(y.date || '').localeCompare(String(x.date || '')),
        );
      const ships = bbs.filter((b) => !b.ccu && b.kind === 'ship').length;
      const packs = bbs.filter((b) => !b.ccu && b.kind !== 'ship').length;
      const ccus = bbs.filter((b) => b.ccu).length;
      const store = s.storeOf(title);
      const link = (store && store.link) || null;
      // A name twice in the list (never by hand) still gets its own row.
      let key = name;
      while (keys.has(key)) key += '+';
      keys.add(key);
      return {
        key,
        name,
        title,
        price: v && v.msrp ? a.dollars(v.msrp) : null,
        link,
        stock: link ? s.stock(link) : null,
        status: (v && (s.shipStates.find(([k]) => k === v.status) || [])[1]) || '',
        summary: [plural(ships, 'ship'), plural(packs, 'pack'), plural(ccus, 'CCU')]
          .filter(Boolean)
          .join(' · '),
        have: owned.get(s.shipKey(title)) || 0,
        bbs: bbs.map((b) => ({
          type: bbType(b),
          name: s.buybackName(b),
          full: s.bbFullName(b),
          date: b.date || '',
          id: /^\d+$/.test(String(b.id)) ? String(b.id) : '',
          price: s.bbPriceText(b),
          reclaim: s.reclaimOf(b),
        })),
      };
    });
    return {
      rows,
      count: st.wishlist.length,
      sort: st.wishSort,
      mine: st.wishSort === 'mine',
      unchecked: s.uncheckedPacks(),
      feedLoaded: s.feedLoaded,
      undo: s.undo,
    };
  });

  // Ask the store pages of the ships on show (each once per renderStore()).
  $effect(() => {
    if (d) s.checkStock(d.rows.map((r) => r.link).filter(Boolean));
  });

  // Which rows have their buy-backs open (by row key).
  let opened = $state({});

  // "My order": press a row and drag it; the row lifts and follows the pointer,
  // and the rows it passes slide out of the way (animated). Let go to save.
  // Pointer events rather than native drag-and-drop, so there's no ghost image.
  let order = $state(null); // row keys while dragging, else null
  let liftedKey = $state(null);
  let drag = null; // { key, body, startY, grab, pointerId, moved }
  const shown = $derived.by(() => {
    if (!d) return [];
    if (!order) return d.rows;
    const byKey = new Map(d.rows.map((r) => [r.key, r]));
    return order.map((k) => byKey.get(k)).filter(Boolean);
  });
  // Others slide while a row is dragged; nothing animates otherwise.
  const slide = (node, rects) =>
    drag && node !== drag.body ? flip(node, rects, { duration: 160 }) : { duration: 0 };
  // The dragged row (and its buy-backs row) follow the pointer.
  const lift = (dy) => {
    for (const tr of drag.body.rows) tr.style.transform = dy == null ? '' : `translateY(${dy}px)`;
  };

  function down(e, row) {
    if (!d || !d.mine || e.button !== 0) return;
    // Only the ship's own row lifts it, not its buy-backs underneath.
    if (!e.target.closest('tr[data-wish-name]')) return;
    if (e.target.closest('a, button, input, select') && !e.target.closest('.wish-grip')) return;
    const body = e.target.closest('tbody[data-key]');
    if (!body) return;
    e.preventDefault();
    drag = {
      key: row.key,
      body,
      startY: e.clientY,
      grab: e.clientY - body.getBoundingClientRect().top, // where on the row it was held
      pointerId: e.pointerId,
      moved: false,
    };
    try {
      body.rows[0].setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone: the window listeners below still see the rest.
    }
    order = d.rows.map((r) => r.key);
    liftedKey = row.key;
  }
  async function move(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const cur = drag;
    cur.moved = cur.moved || Math.abs(e.clientY - cur.startY) > 3;
    // The first other row whose middle is below the pointer: drop in front of it.
    const bodies = [...cur.body.parentElement.querySelectorAll(':scope > tbody')];
    const target = bodies.find((b) => {
      if (b === cur.body) return false;
      const r = b.rows[0].getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    const without = order.filter((k) => k !== cur.key);
    const at = target ? without.indexOf(target.dataset.key) : without.length;
    const next = [...without.slice(0, at), cur.key, ...without.slice(at)];
    if (next.join('\n') !== order.join('\n')) {
      order = next;
      await tick();
      if (drag !== cur) return;
    }
    // Keep the held row under the pointer (offset from its slot in the list).
    lift(null);
    const slot = cur.body.getBoundingClientRect().top;
    lift(e.clientY - cur.grab - slot);
  }
  function end(e) {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const { moved } = drag;
    lift(null);
    drag = null;
    liftedKey = null;
    const keys = order;
    order = null;
    if (!moved || !d) return;
    const nameOf = new Map(d.rows.map((r) => [r.key, r.name]));
    s.setWishOrder(keys.map((k) => nameOf.get(k)));
  }
</script>

<svelte:window onpointermove={move} onpointerup={end} onpointercancel={end} />

<div class="store-panel">
  <div class="sp-head">
    <h3>Wishlist <span class="market-n" id="wish-n">{d && d.count ? d.count : ''}</span></h3>
    <label class="wish-sort-label"
      >Sort
      <select
        id="wish-sort"
        aria-label="Sort wishlist"
        value={d ? d.sort : 'name'}
        onchange={(e) => s.setWishSort(e.currentTarget.value)}
      >
        {#each s.wishSorts as [k, label] (k)}
          <option value={k}>{label}</option>
        {/each}
      </select></label
    >
  </div>
  <div class="wish-undo" id="wish-undo" role="status" hidden={!d || !d.undo}>
    {#if d && d.undo}
      Removed {d.undo.name} from your wishlist.
      <button type="button" class="ship-link wish-undo-btn" data-wish-undo>Undo</button>
    {/if}
  </div>
  <div class="sp-scroll" id="wishlist">
    {#if !d}
      <!-- Nothing to work out while another page is showing. -->
    {:else if !d.rows.length}
      <p class="muted sp-empty">
        Your wishlist is emptier than a Hull C on launch day. Open any ship (Find a Ship below,
        or the search at the top) and press <strong>Add to Wishlist</strong>.
      </p>
    {:else}
      {#if d.unchecked}
        <p class="muted value-note">
          {d.unchecked} pack buy-back{d.unchecked === 1 ? '' : 's'} not checked yet: RSI's list only
          names the first item in a pack.
          <a href="#buybacks" data-view="buybacks">Load Details</a> on the Buy-Backs page to find
          your wishlist ships inside every pack.
        </p>
      {/if}
      <table class="org-table wishlist">
        <thead>
          <tr>
            <th>Ship</th>
            <th class="num">Store Price</th>
            <th>In Store Now</th>
            <th>Status</th>
            <th>Buy-backs</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        {#each shown as r (r.key)}
          <tbody data-key={r.key} animate:slide onpointerdown={(e) => down(e, r)}>
            <tr
              class:wish-drag={d.mine}
              class:lifted={liftedKey === r.key}
              data-wish-name={d.mine ? r.name : undefined}
            >
              <td>
                {#if d.mine}
                  <span class="wish-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
                {/if}<ShipLink name={r.title} />
              </td>
              <td class="num">{#if r.price}{r.price}{:else}<span class="muted">—</span>{/if}</td>
              <td>
                {#if r.link}
                  <a
                    class="sale {r.stock ? r.stock.cls : ''}"
                    href={r.link}
                    target="_blank"
                    rel="noopener"
                    title={r.stock ? r.stock.title : undefined}
                    >{r.stock ? r.stock.text : 'Checking…'}</a
                  >
                {:else if d.feedLoaded}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td>{r.status}</td>
              <td>
                {#if r.bbs.length}
                  <button
                    type="button"
                    class="ship-link wish-open"
                    aria-expanded={!!opened[r.key]}
                    onclick={() => (opened[r.key] = !opened[r.key])}>{r.summary} ▾</button
                  >
                {:else}
                  <span class="muted">none</span>
                {/if}
              </td>
              <td>{r.have ? `you own ${r.have}` : ''}</td>
              <td class="num">
                <button
                  type="button"
                  class="wish-x"
                  data-wish-remove={r.name}
                  title="Remove from wishlist"
                  aria-label="Remove {r.title} from wishlist">✕</button
                >
              </td>
            </tr>
            {#if r.bbs.length}
              <tr class="wish-bbs" hidden={!opened[r.key]}>
                <td colspan="7">
                  <table class="org-table inner">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Buy-back</th>
                        <th>Melted</th>
                        <th>Pledge ID</th>
                        <th class="num">Price</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each r.bbs as b}
                        <tr>
                          <td><span class="badge {b.type.toLowerCase()}">{b.type}</span></td>
                          <td title={b.full}>{b.name}</td>
                          <td>{b.date}</td>
                          <td>{#if b.id}{b.id}{:else}<span class="muted">—</span>{/if}</td>
                          <td class="num">
                            {#if b.price}{b.price}{:else}<span class="muted">—</span>{/if}
                          </td>
                          <td class="num">
                            {#if b.reclaim && b.reclaim.blocked}
                              <span class="bb-retired bb-blocked" title={b.reclaim.blocked}
                                >Can't Be Bought Back</span
                              >
                            {:else if b.reclaim && b.reclaim.retired && b.reclaim.url}
                              <a
                                class="bb-retired"
                                href={b.reclaim.url}
                                target="_blank"
                                rel="noopener"
                                title={b.reclaim.retired}>Retired, Buy-Back Still Open ↗</a
                              >
                            {:else if b.reclaim && b.reclaim.retired}
                              <span class="bb-retired" title={b.reclaim.retired}>Retired, Buy-Back Still Open</span>
                            {:else if b.reclaim}
                              <a
                                class="bb-reclaim"
                                href={b.reclaim.url}
                                target="_blank"
                                rel="noopener"
                                title={b.reclaim.tip}>Reclaim ↗</a
                              >
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </td>
              </tr>
            {/if}
          </tbody>
        {/each}
      </table>
    {/if}
  </div>
</div>
