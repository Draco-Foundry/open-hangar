<script>
  // Stats → Collection: insurance, giftable / meltable counts, and how much of each
  // manufacturer's line-up you own.
  import { app, OH, version } from '../lib/app.svelte.js';
  import Bars from './Bars.svelte';

  const insOrder = (t) => (t === 'LTI' ? 1e6 : parseInt(t, 10) * (/y/i.test(t) ? 12 : 1) || 0);

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    if (!s.shipOf)
      return {
        msg: a.pricesLoading ? 'Loading ship data…' : 'Ship data unavailable (offline?).',
      };
    const c = OH().collectionStats(s.items, s.shipOf, s.catalog || []);
    const ins = Object.entries(c.insurance)
      .sort((x, y) => insOrder(y[0]) - insOrder(x[0]))
      .map(([t, n]) => [a.insLabel(t), n]);
    const withIns = ins.reduce((acc, r) => acc + r[1], 0);
    const lti = c.insurance.LTI || 0;
    return {
      boxes: [
        [withIns ? `${Math.round((lti / withIns) * 100)}%` : '—', 'of insured pledges are LTI'],
        [c.giftable, 'giftable'],
        [c.notGiftable, 'not giftable'],
        [c.meltable, 'meltable'],
        [c.makers.length, 'manufacturers'],
      ],
      ins,
      makers: c.makers.map((m) => ({
        name: m.name,
        models: m.models.join(', '),
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
    {#each d.boxes as [big, lbl]}
      <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
    {/each}
  </div>
  <h3 class="section-title">Insurance</h3>
  {#if d.ins.length}
    <Bars rows={d.ins} />
  {:else}
    <p class="muted">No insurance found in your pledges. Fly carefully out there.</p>
  {/if}
  <h3 class="section-title" style="margin-top:26px">Collection by Manufacturer</h3>
  <p class="muted value-note tight">
    How many of each maker's ship models you own (out of the ones with a store price). Hover a row
    to see which.
  </p>
  {#each d.makers as m}
    <div class="bar-row" title={m.models}>
      <div class="bar-label">{m.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:{m.pct}%"></div></div>
      <div class="bar-val">{m.val}</div>
    </div>
  {:else}
    <p class="muted">
      No ships matched the ship list yet. Scan and they’ll roll out of the hangar.
    </p>
  {/each}
{/if}
