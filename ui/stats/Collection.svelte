<script>
  // Stats → Collection: insurance, giftable / meltable counts, and how much of each
  // manufacturer's line-up you own.
  import { app, OH, version } from '../lib/app.svelte.js';
  import Box from './Box.svelte';
  import Bar from './Bar.svelte';

  const a = app();
  const insOrder = (t) => (t === 'LTI' ? 1e6 : parseInt(t, 10) * (/y/i.test(t) ? 12 : 1) || 0);
  const d = $derived.by(() => {
    version.n;
    const st = a.state;
    if (!st.shipOf) return { msg: a.pricesLoading ? 'Loading ship data…' : 'Ship data unavailable (offline?).' };
    const c = OH().collectionStats(st.items, st.shipOf, st.catalog || []);
    const ins = Object.entries(c.insurance)
      .sort((x, y) => insOrder(y[0]) - insOrder(x[0]))
      .map(([t, n]) => [a.insLabel(t), n]);
    const withIns = ins.reduce((s, r) => s + r[1], 0);
    const lti = c.insurance.LTI || 0;
    const insMax = Math.max(1, ...ins.map((r) => r[1]));
    return {
      boxes: [
        [withIns ? `${Math.round((lti / withIns) * 100)}%` : '—', 'of insured pledges are LTI'],
        [c.giftable, 'giftable'],
        [c.notGiftable, 'not giftable'],
        [c.meltable, 'meltable'],
        [c.makers.length, 'manufacturers'],
      ],
      ins: ins.map(([label, n]) => ({ label, n, pct: Math.round((n / insMax) * 100) })),
      makers: c.makers.map((m) => ({
        name: m.name,
        title: m.models.join(', '),
        pct: Math.round((m.own / m.total) * 100),
        val: `${m.own} of ${m.total}`,
      })),
    };
  });
</script>

{#if d.msg}
  <p class="muted">{d.msg}</p>
{:else}
  <div class="stat-grid">
    {#each d.boxes as [big, lbl] (lbl)}<Box {big} {lbl} />{/each}
  </div>
  <h3 class="section-title">Insurance</h3>
  {#each d.ins as r}
    <Bar label={r.label} pct={r.pct} val={r.n} />
  {:else}
    <p class="muted">No insurance found in your pledges. Fly carefully out there.</p>
  {/each}
  <h3 class="section-title" style="margin-top:26px">Collection by Manufacturer</h3>
  <p class="muted value-note tight">
    How many of each maker's ship models you own (out of the ones with a store price). Hover a row
    to see which.
  </p>
  {#each d.makers as m}
    <Bar label={m.name} pct={m.pct} val={m.val} title={m.title} />
  {:else}
    <p class="muted">No ships matched the ship list yet. Scan and they’ll roll out of the hangar.</p>
  {/each}
{/if}
