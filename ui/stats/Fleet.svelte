<script>
  // Stats → Fleet: what your ships are for, how big, how many fly today; then the
  // loaners your not-yet-flyable ships give you and the vessels they come with.
  import { app, OH, version } from '../lib/app.svelte.js';
  import ShipLink from './ShipLink.svelte';

  const bars = (a, map) => {
    const rows = Object.entries(map).sort((x, y) => y[1] - x[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.map(([k, n]) => ({ label: a.titleCase(k), n, pct: Math.round((n / max) * 100) }));
  };

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const s = a.state;
    let fleet = null;
    if (s.shipOf) {
      const f = OH().fleetStats(s.items, s.shipOf);
      if (f.ships)
        fleet = {
          boxes: [
            [f.ships, 'ships & vehicles'],
            [`${f.byStatus['flight-ready'] || 0} / ${f.known}`, 'flight ready'],
            [Math.round(f.cargo).toLocaleString('en-US'), 'cargo (SCU)'],
            [f.crew.toLocaleString('en-US'), 'crew seats'],
          ],
          role: bars(a, f.byCareer),
          size: bars(a, f.bySize),
          unknown: f.ships - f.known,
        };
    }
    const loaded = a.loanersLoaded;
    const owned = loaded.matrix || loaded.included ? a.ownedShips() : [];
    const byShip = (x, y) => x.ship.localeCompare(y.ship);
    const loaners = [];
    const included = [];
    for (const sh of owned) {
      const row = a.loanersOf(sh.label);
      if (row) loaners.push({ ship: sh.label, list: row.loaners });
      const inc = a.includedOf(sh.label);
      if (inc) included.push({ ship: sh.label, list: inc });
    }
    return {
      fleet,
      noFleet: a.pricesLoading ? 'Loading ship data…' : 'Ship data unavailable (offline?).',
      matrix: loaded.matrix,
      inclLoaded: loaded.included,
      loaners: loaners.sort(byShip),
      allLoaners: [...new Set(loaners.flatMap((r) => r.list))].sort((x, y) => x.localeCompare(y)),
      included: included.sort(byShip),
    };
  });
  // "G12* (currently Cyclone)" opens the G12.
  const vessel = (t) => t.replace(/\s*\(.*\)\s*$/, '').trim();
</script>

{#if d.fleet}
  <div class="stat-grid">
    {#each d.fleet.boxes as [big, lbl]}
      <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
    {/each}
  </div>
  <div class="fleet-cols">
    {#each [['By Role', d.fleet.role], ['By Size', d.fleet.size]] as [title, rows]}
      <div>
        <h4 class="modal-h">{title}</h4>
        {#each rows as r}
          <div class="bar-row">
            <div class="bar-label">{r.label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:{r.pct}%"></div></div>
            <div class="bar-val">{r.n}</div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <p class="muted value-note">
    Ship data from star-citizen.wiki{d.fleet.unknown
      ? ` · ${d.fleet.unknown} ship${d.fleet.unknown === 1 ? '' : 's'} not matched`
      : ''}. Crew seats = each ship's maximum crew.
  </p>
{:else}
  <p class="muted">{d.noFleet}</p>
{/if}

<h3 class="section-title" style="margin-top:26px">Loaners</h3>
{#if !d.matrix}
  <p class="muted">Loading RSI's loaner list…</p>
{:else if !d.loaners.length}
  <p class="muted">
    Every ship you own is flight ready, so no loaners for you. Loaners only come with ships you
    can't fly in the game yet.
  </p>
{:else}
  <p>
    You can fly <strong>{d.allLoaners.length}</strong>
    loaner{d.allLoaners.length === 1 ? '' : 's'}:
    {#each d.allLoaners as l, i}{#if i}, {/if}<ShipLink name={l} />{/each}.
  </p>
  <table class="org-table">
    <thead><tr><th>Your Ship</th><th>Loaners</th></tr></thead>
    <tbody>
      {#each d.loaners as r}
        <tr>
          <td><ShipLink name={r.ship} /></td>
          <td>{#each r.list as l, i}{#if i}, {/if}<ShipLink name={l} />{/each}</td>
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
{#if !d.inclLoaded}
  <p class="muted">Loading RSI's included-vessels list…</p>
{:else if !d.included.length}
  <p class="muted">None of your ships come with a snub or ground vehicle tucked inside.</p>
{:else}
  <table class="org-table">
    <thead><tr><th>Your Ship</th><th>Comes With</th></tr></thead>
    <tbody>
      {#each d.included as r}
        <tr>
          <td><ShipLink name={r.ship} /></td>
          <td>
            {#each r.list as t, i}{#if i}, {/if}<ShipLink name={vessel(t)} text={t} />{/each}
          </td>
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
