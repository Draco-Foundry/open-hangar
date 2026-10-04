<script>
  // Stats → Top Lists: most valuable pledges, biggest savings vs store price, oldest
  // pledges, most valuable LTI ships. Every row opens its pledge.
  import { app, version } from '../lib/app.svelte.js';
  import Row from './Row.svelte';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const items = a.state.items;
    const row = (p, right) => ({ id: p.id, name: a.plainName(p), right });
    const dt = (p) => {
      const t = Date.parse(p.date);
      return Number.isNaN(t) ? null : t;
    };
    const v = a.hangarValue();
    const savings = v
      ? items
          .map((p) => ({ p, si: v.pledges[p.id] }))
          // paid > 0: free rewards aren't savings
          .filter((x) => x.si && x.si.store && x.si.paid > 0 && x.si.store - x.si.paid >= 1)
          .sort((x, y) => y.si.store - y.si.paid - (x.si.store - x.si.paid))
          .slice(0, 10)
      : [];
    return [
      {
        title: 'Most Valuable Pledges',
        rows: items
          .filter((p) => Number.isFinite(p.value) && p.value > 0)
          .sort((x, y) => y.value - x.value)
          .slice(0, 10)
          .map((p) => row(p, a.formatValue(p))),
      },
      {
        title: 'Biggest Savings vs Store Price',
        rows: savings.map(({ p, si }) => ({
          ...row(p, `${a.dollars(si.paid)} → ${a.dollars(si.store)}`),
          gain: a.dollars(si.store - si.paid),
        })),
      },
      {
        title: 'Oldest Pledges',
        rows: items
          .filter((p) => dt(p) != null)
          .sort((x, y) => dt(x) - dt(y))
          .slice(0, 10)
          .map((p) => row(p, p.date)),
      },
      {
        title: 'Most Valuable LTI Ships',
        rows: items
          .filter((p) => p.insurance === 'LTI' && p.containsShip && Number.isFinite(p.value))
          .sort((x, y) => y.value - x.value)
          .slice(0, 10)
          .map((p) => row(p, a.formatValue(p))),
      },
    ];
  });
</script>

<div class="top-cols">
  {#each d as list}
    <div>
      <h3 class="section-title">{list.title}</h3>
      <div class="top-list">
        {#each list.rows as r}
          <Row item={r.id} name={r.name}>
            {r.right}{#if r.gain}{' '}<span class="gain">+{r.gain}</span>{/if}
          </Row>
        {:else}
          <div class="row muted">Nothing here yet.</div>
        {/each}
      </div>
    </div>
  {/each}
</div>
<p class="muted value-note">
  Click any row to open it. Savings compare melt value with today's standard store price (warbonds,
  sales, CCU'd pledges).
</p>
