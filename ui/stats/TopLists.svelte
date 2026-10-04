<script>
  // Stats → Top Lists: four top-10s side by side. Every row opens its pledge.
  import { app, version } from '../lib/app.svelte.js';
  import Row from './Row.svelte';

  const a = app();
  const d = $derived.by(() => {
    version.n;
    const items = a.state.items;
    const usd = a.dollars;
    const row = (p, val) => ({ id: String(p.id), name: a.plainName(p), val });
    const dt = (p) => {
      const t = Date.parse(p.date);
      return Number.isNaN(t) ? null : t;
    };
    const v = a.hangarValue();
    return {
      byValue: items
        .filter((p) => Number.isFinite(p.value) && p.value > 0)
        .sort((x, y) => y.value - x.value)
        .slice(0, 10)
        .map((p) => row(p, a.formatValue(p))),
      savings: v
        ? items
            .map((p) => ({ p, si: v.pledges[p.id] }))
            // paid > 0: free rewards aren't savings
            .filter((x) => x.si && x.si.store && x.si.paid > 0 && x.si.store - x.si.paid >= 1)
            .sort((x, y) => y.si.store - y.si.paid - (x.si.store - x.si.paid))
            .slice(0, 10)
            .map(({ p, si }) => ({
              ...row(p, ''),
              paid: usd(si.paid),
              store: usd(si.store),
              gain: usd(si.store - si.paid),
            }))
        : [],
      oldest: items
        .filter((p) => dt(p) != null)
        .sort((x, y) => dt(x) - dt(y))
        .slice(0, 10)
        .map((p) => row(p, p.date)),
      lti: items
        .filter((p) => p.insurance === 'LTI' && p.containsShip && Number.isFinite(p.value))
        .sort((x, y) => y.value - x.value)
        .slice(0, 10)
        .map((p) => row(p, a.formatValue(p))),
    };
  });
</script>

{#snippet list(title, rows)}
  <div>
    <h3 class="section-title">{title}</h3>
    <div class="top-list">
      {#each rows as r}
        <Row name={r.name} item={r.id}>{r.val}</Row>
      {:else}
        <div class="row muted">Nothing here yet.</div>
      {/each}
    </div>
  </div>
{/snippet}

<div class="top-cols">
  {@render list('Most Valuable Pledges', d.byValue)}
  <div>
    <h3 class="section-title">Biggest Savings vs Store Price</h3>
    <div class="top-list">
      {#each d.savings as r}
        <Row name={r.name} item={r.id}>{r.paid} → {r.store} <span class="gain">+{r.gain}</span></Row>
      {:else}
        <div class="row muted">Nothing here yet.</div>
      {/each}
    </div>
  </div>
  {@render list('Oldest Pledges', d.oldest)}
  {@render list('Most Valuable LTI Ships', d.lti)}
</div>
<p class="muted value-note">
  Click any row to open it. Savings compare melt value with today's standard store price
  (warbonds, sales, CCU'd pledges).
</p>
