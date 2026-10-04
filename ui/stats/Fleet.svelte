<script>
  // Stats → Fleet: what your ships are for, how big, how many fly today; then the
  // loaners your not-yet-flyable ships give you and the snubs and rovers they come
  // with for keeps (RSI's lists, fetched the first time this tab opens).
  import { app, OH, version } from '../lib/app.svelte.js';
  import Box from './Box.svelte';
  import Bar from './Bar.svelte';
  import ShipLink from './ShipLink.svelte';

  const a = app();
  $effect(() => a.ensureLoaners());

  const bars = (map) => {
    const rows = Object.entries(map).sort((x, y) => y[1] - x[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.map(([k, n]) => ({ label: a.titleCase(k), pct: Math.round((n / max) * 100), n }));
  };
  const fleet = $derived.by(() => {
    version.n;
    const st = a.state;
    if (!st.shipOf) return null;
    const f = OH().fleetStats(st.items, st.shipOf);
    if (!f.ships) return null;
    const unknown = f.ships - f.known;
    return {
      boxes: [
        [f.ships, 'ships & vehicles'],
        [`${f.byStatus['flight-ready'] || 0} / ${f.known}`, 'flight ready'],
        [Math.round(f.cargo).toLocaleString('en-US'), 'cargo (SCU)'],
        [f.crew.toLocaleString('en-US'), 'crew seats'],
      ],
      byRole: bars(f.byCareer),
      bySize: bars(f.bySize),
      unknown: unknown ? ` · ${unknown} ship${unknown === 1 ? '' : 's'} not matched` : '',
    };
  });
  const loading = $derived.by(() => (version.n, a.pricesLoading));
  const byShip = (x, y) => x.ship.localeCompare(y.ship);
  const loaners = $derived.by(() => {
    version.n;
    const rows = a.loanerRows();
    if (!rows) return null;
    return {
      rows: rows.sort(byShip),
      all: [...new Set(rows.flatMap((r) => r.list))].sort((x, y) => x.localeCompare(y)),
    };
  });
  const included = $derived.by(() => {
    version.n;
    const rows = a.includedRows();
    return rows && rows.sort(byShip);
  });
  // "G12 (currently Cyclone)" opens the G12.
  const bare = (t) => t.replace(/\s*\(.*\)\s*$/, '').trim();
</script>

{#if fleet}
  <div class="stat-grid">
    {#each fleet.boxes as [big, lbl] (lbl)}<Box {big} {lbl} />{/each}
  </div>
  <div class="fleet-cols">
    <div>
      <h4 class="modal-h">By Role</h4>
      {#each fleet.byRole as b}<Bar label={b.label} pct={b.pct} val={b.n} />{/each}
    </div>
    <div>
      <h4 class="modal-h">By Size</h4>
      {#each fleet.bySize as b}<Bar label={b.label} pct={b.pct} val={b.n} />{/each}
    </div>
  </div>
  <p class="muted value-note">
    Ship data from star-citizen.wiki{fleet.unknown}. Crew seats = each ship's maximum crew.
  </p>
{:else}
  <p class="muted">{loading ? 'Loading ship data…' : 'Ship data unavailable (offline?).'}</p>
{/if}

<h3 class="section-title" style="margin-top:26px">Loaners</h3>
{#if !loaners}
  <p class="muted">Loading RSI's loaner list…</p>
{:else if !loaners.rows.length}
  <p class="muted">
    Every ship you own is flight ready, so no loaners for you. Loaners only come with ships you
    can't fly in the game yet.
  </p>
{:else}
  <p>
    You can fly <strong>{loaners.all.length}</strong> loaner{loaners.all.length === 1 ? '' : 's'}:
    {#each loaners.all as l, i}{#if i},{' '}{/if}<ShipLink name={l} />{/each}.
  </p>
  <table class="org-table">
    <thead><tr><th>Your Ship</th><th>Loaners</th></tr></thead>
    <tbody>
      {#each loaners.rows as r}
        <tr>
          <td><ShipLink name={r.ship} /></td>
          <td>{#each r.list as l, i}{#if i},{' '}{/if}<ShipLink name={l} />{/each}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="muted value-note">
    From RSI's <a
      href="https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114"
      target="_blank"
      rel="noopener">Loaner Ship Matrix</a
    >. Loaners are only given while a ship isn't flyable in the game yet (they go away once it's
    flight ready), need a game package on the account, and don't stack.
  </p>
{/if}

<h3 class="section-title" style="margin-top:26px">Included Vessels</h3>
{#if !included}
  <p class="muted">Loading RSI's included-vessels list…</p>
{:else if !included.length}
  <p class="muted">None of your ships come with a snub or ground vehicle tucked inside.</p>
{:else}
  <table class="org-table">
    <thead><tr><th>Your Ship</th><th>Comes With</th></tr></thead>
    <tbody>
      {#each included as r}
        <tr>
          <td><ShipLink name={r.ship} /></td>
          <td>{#each r.list as t, i}{#if i},{' '}{/if}<ShipLink name={bare(t)} text={t} />{/each}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="muted value-note">
    From RSI's <a
      href="https://support.robertsspaceindustries.com/hc/en-us/articles/4408770370455"
      target="_blank"
      rel="noopener">Included Vessels</a
    > list. Unlike loaners, these are yours to keep.
  </p>
{/if}
