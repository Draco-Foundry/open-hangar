<script>
  // Ship Prices: tabs (Flight Ready, In Concept incl. in production, All), a search,
  // and every ship with a standard store price.
  import { app, version } from '../lib/app.svelte.js';
  import ShipLink from './ShipLink.svelte';
  import { searchMeta } from './search.js';

  let q = $state('');
  const s = app().store;

  const d = $derived.by(() => {
    version.n;
    const a = app();
    if (!s.active) return null;
    const tab = a.state.priceTab;
    const base = { tab, note: s.currencyNote() };
    if (!a.state.catalog) return { ...base, loading: true };
    const label = (st) =>
      (s.shipStates.find(([k]) => k === st) || [])[1] || s.capFirst(st || '');
    const inTab = a.state.catalog
      .filter((v) => v.msrp)
      .filter((v) => {
        if (tab === 'all') return true;
        if (tab === 'in-concept') return v.status === 'in-concept' || v.status === 'in-production';
        return v.status === tab;
      })
      .sort((x, y) => (x.name || x.lname).localeCompare(y.name || y.lname))
      .map((v) => ({
        lname: v.lname,
        name: v.name || v.lname,
        price: a.dollars(v.msrp),
        status: label(v.status),
        role: v.role || '',
        size: s.titleCase(v.size),
      }));
    return { ...base, inTab };
  });
  const rows = $derived.by(() => {
    if (!d || d.loading) return [];
    const needle = q.trim().toLowerCase();
    return d.inTab.filter((v) => !needle || v.lname.includes(needle));
  });
  const meta = $derived(
    d && !d.loading ? searchMeta(q, rows.length, d.inTab.length, 'ship') : null,
  );
</script>

<div class="store-panel">
  <div class="sp-head">
    <h3>Ship Prices</h3>
    <div class="layout-toggle sp-tabs" id="price-tabs" role="tablist">
      {#each s.priceTabs as [k, label] (k)}
        <button
          type="button"
          role="tab"
          aria-selected={d ? d.tab === k : false}
          data-price-tab={k}
          class={d && d.tab === k ? 'active' : ''}
          onclick={() => s.setPriceTab(k)}>{label}</button
        >
      {/each}
    </div>
    <span class="sp-count" id="price-search-count" aria-live="polite"
      >{meta ? meta.count : ''}</span
    >
    <input
      id="price-search"
      type="search"
      placeholder={meta ? meta.placeholder : 'Search ships…'}
      autocomplete="off"
      aria-label="Search Ship Prices"
      bind:value={q}
    />
  </div>
  <p class="muted store-intro" hidden={!d || !d.note}>{d ? d.note : ''}</p>
  <div class="sp-scroll tall" id="price-table">
    {#if !d}
      <!-- Nothing to work out while another page is showing. -->
    {:else if d.loading}
      <p class="muted sp-empty">Loading ship prices…</p>
    {:else if !rows.length}
      <p class="muted sp-empty">No ships match. Maybe it’s still a JPEG?</p>
    {:else}
      <table class="org-table">
        <thead>
          <tr>
            <th>Ship</th>
            <th class="num">Store Price</th>
            <th>Status</th>
            <th>Role</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as v}
            <tr>
              <td><ShipLink name={v.name} /></td>
              <td class="num">{v.price}</td>
              <td>{v.status}</td>
              <td>{v.role}</td>
              <td>{v.size}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
  <p class="muted value-note">
    Standard store prices (USD, before tax). To see if a ship is in RSI's store right now, open it
    (or add it to your wishlist): that checks its RSI store page.
  </p>
</div>
