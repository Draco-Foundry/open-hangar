<script>
  // Your CCUs: identical ones stacked, searchable, all of them (not just priced).
  // No search box when there are only a few to look through.
  import { app, OH, version } from '../lib/app.svelte.js';
  import ShipLink from './ShipLink.svelte';
  import { searchMeta } from './search.js';

  let q = $state('');
  const loadingQuip = OH().quip('loading');

  const d = $derived.by(() => {
    version.n;
    const a = app();
    if (!a.store.active) return null;
    const st = a.state;
    if (!st.catalog) return { loading: true };
    const v = a.hangarValue();
    const stacks = new Map();
    for (const p of st.items) {
      if (!p.isCCU || !p.ccu) continue;
      const from = OH().htfShipName(p.ccu.from) || p.ccu.from;
      const to = OH().htfShipName(p.ccu.to) || p.ccu.to;
      const key = `${from}→${to}`.toLowerCase();
      const si = v && v.pledges[p.id];
      const s = stacks.get(key) || { key, from, to, n: 0, paid: 0, worth: null };
      s.n++;
      s.paid += Number.isFinite(p.value) ? p.value : 0;
      if (si && si.from && si.to) s.worth = si.to - si.from;
      stacks.set(key, s);
    }
    // Amounts formatted here, so a currency switch (which redraws) shows everywhere.
    const all = [...stacks.values()].map((s) => ({
      ...s,
      worthText: s.worth != null ? a.dollars(s.worth) : null,
      paidText: a.money(s.paid),
    }));
    return {
      all,
      count: st.items.filter((p) => p.isCCU).length,
    };
  });

  const shown = $derived.by(() => {
    if (!d || d.loading) return [];
    const needle = q.trim().toLowerCase();
    return d.all
      .filter((c) => !needle || `${c.from} ${c.to}`.toLowerCase().includes(needle))
      .sort((a, b) => (b.worth || 0) - (a.worth || 0));
  });
  const meta = $derived(
    d && !d.loading ? searchMeta(q, shown.length, d.all.length, 'CCU') : null,
  );
  // Only a handful of CCUs (and nothing typed): no search box.
  const few = $derived(!!d && !d.loading && d.all.length <= 8 && !q.trim());
</script>

<div class="store-panel">
  <div class="sp-head">
    <h3>
      Your CCUs <span class="market-n" id="ccu-n">{d && d.count ? d.count : ''}</span>
    </h3>
    <span class="sp-count" id="ccu-search-count" aria-live="polite" hidden={few}
      >{meta ? meta.count : ''}</span
    >
    <input
      id="ccu-search"
      type="search"
      placeholder={meta ? meta.placeholder : 'Search CCUs…'}
      autocomplete="off"
      aria-label="Search Your CCUs"
      hidden={few}
      bind:value={q}
    />
  </div>
  <div class="sp-scroll" id="ccu-owned">
    {#if !d}
      <!-- Nothing to work out while another page is showing. -->
    {:else if d.loading}
      <p class="muted sp-empty">{loadingQuip}</p>
    {:else if !d.all.length}
      <p class="muted sp-empty">No CCUs in your hangar. Chain-free living.</p>
    {:else if !shown.length}
      <p class="muted sp-empty">No CCUs match that search.</p>
    {:else}
      <table class="org-table">
        <thead>
          <tr>
            <th>Upgrade</th>
            <th class="num">Worth</th>
            <th class="num">You Paid</th>
            <th class="num">Stock</th>
          </tr>
        </thead>
        <tbody>
          {#each shown as c (c.key)}
            <tr>
              <td>
                <ShipLink name={c.from} /> <span class="ccu-flow">→</span>
                <ShipLink name={c.to} />
              </td>
              <td class="num">
                {#if c.worthText}{c.worthText}{:else}<span class="muted">—</span>{/if}
              </td>
              <td class="num">{c.paidText}</td>
              <td class="num">{c.n}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
