<script>
  // Stats → Value (Hangar Value): ships at today's store price vs their melt value,
  // best deals, and which ships couldn't be priced.
  import { app, version } from '../lib/app.svelte.js';
  import Box from './Box.svelte';
  import Row from './Row.svelte';

  const a = app();
  const d = $derived.by(() => {
    version.n;
    const v = a.hangarValue();
    if (!v)
      return { msg: a.pricesLoading ? 'Loading store prices…' : 'Store prices unavailable (offline?).' };
    if (!v.ships) return null;
    const usd = a.dollars;
    const gap = v.storePriced - v.paidPriced;
    const sign = gap >= 0 ? '+' : '−';
    const pct = v.paidPriced ? Math.round((Math.abs(gap) / v.paidPriced) * 100) : 0;
    const boxes = [
      [usd(v.store), 'ships at store price', ''],
      [`${v.priced} / ${v.ships}`, 'ships priced', ''],
    ];
    if (v.paidPriced)
      boxes.push([
        `${sign}${usd(Math.abs(gap))}`,
        `vs melt value${pct ? ` (${sign}${pct}%)` : ''}`,
        gap >= 0 ? 'good' : '',
      ]);
    if (v.ccu.priced)
      boxes.push([
        usd(v.ccu.store),
        `${v.ccu.priced} CCU${v.ccu.priced === 1 ? '' : 's'} at standard price (paid ${usd(v.ccu.paid)})`,
        v.ccu.store > v.ccu.paid ? 'good' : '',
      ]);
    const deals = a.state.items
      .map((p) => ({ p, si: v.pledges[p.id] }))
      .filter((x) => x.si && x.si.below)
      .sort((x, y) => y.si.store - y.si.paid - (x.si.store - x.si.paid))
      .slice(0, 10)
      .map(({ p, si }) => ({
        name: a.plainName(p),
        paid: usd(si.paid),
        store: usd(si.store),
        gain: usd(si.store - si.paid),
      }));
    const missing = v.ships - v.priced;
    return {
      boxes,
      deals,
      unpriced: v.unpriced.length
        ? {
            title: `${missing} ship${missing === 1 ? '' : 's'} without a public price`,
            names: v.unpriced.map((u) => (u.n > 1 ? `${u.name} ×${u.n}` : u.name)).join(' · '),
          }
        : null,
    };
  });
</script>

{#if d && d.msg}
  <h3 class="section-title">Hangar Value</h3>
  <p class="muted">{d.msg}</p>
{:else if d}
  <h3 class="section-title">Hangar Value</h3>
  <div class="stat-grid">
    {#each d.boxes as [big, lbl, cls]}<Box {big} {lbl} {cls} />{/each}
  </div>
  {#if d.deals.length}
    <h4 class="modal-h">Best Deals: Paid Below Today's Store Price</h4>
    <div class="top-list">
      {#each d.deals as x}
        <Row name={x.name}>{x.paid} → {x.store} <span class="gain">+{x.gain}</span></Row>
      {/each}
    </div>
  {/if}
  {#if d.unpriced}
    <details class="unpriced">
      <summary>{d.unpriced.title}</summary>
      <p class="muted">{d.unpriced.names}</p>
    </details>
  {/if}
  <p class="muted value-note">
    Ships at current standalone store prices (USD, before tax) from star-citizen.wiki; a CCU's
    standard price is the gap between its two ships. Paints, gear and game access aren't counted;
    concept and limited ships often have no public price. "vs melt value" covers ship pledges whose
    ships are all priced. Account Value on Home adds CCUs at standard price, everything else at melt
    value, and your Store Credit; buy-backs, UEC and REC aren't counted. Melt value is the pledge's
    value on RSI (what it was originally bought for); for gifted or grey-market pledges that isn't
    what you paid.
  </p>
{/if}
