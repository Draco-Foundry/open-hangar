<script>
  // Roles: one chip per job the fleet can do (green: flyable today, amber: only
  // in-concept ships, dashed: nobody has one). A chip opens what fills it, or for a
  // missing role every ship in the ship list that would, cheapest first (ships only: the
  // prices just set the order and aren't shown).
  import { app, OH } from '../lib/app.svelte.js';
  import { ui } from './ui.svelte.js';
  import { owners } from './text.js';

  let { f, catalog } = $props();

  const names = (list) => list.map((r) => r.label).join(', ');
  const d = $derived.by(() => {
    const missing = f.roles.filter((r) => !r.count);
    // Covered, but only by ships that aren't flyable yet (in concept / production).
    const concept = f.roles.filter((r) => r.count && !r.ready);
    const chips = f.roles.map((r) => ({
      ...r,
      cls: !r.count ? 'missing' : r.ready ? 'have' : 'concept',
    }));
    return { missing: names(missing), concept: names(concept), chips };
  });

  // The open role's panel.
  const panel = $derived.by(() => {
    const r = f.roles.find((x) => x.key === ui.role);
    if (!r) return null;
    const a = app();
    const tc = a.org.titleCase;
    const def = OH().ORG_ROLES.find((x) => x.key === r.key);
    if (r.count)
      return {
        r,
        ships: f.ships
          .filter((sh) => sh.role && def.re.test(sh.role))
          .map((sh) => ({ ...sh, role: tc(sh.role), owners: owners(sh.owners) })),
      };
    return {
      r,
      // Every ship that fills the role (big ones like the Orion used to fall off a
      // top-10 list), cheapest first; unpriced concepts last.
      options: catalog
        .filter((v) => v.role && def.re.test(v.role))
        .sort((x, y) => (x.msrp || Infinity) - (y.msrp || Infinity))
        .map((v) => ({
          name: v.name || v.lname,
          role: tc(v.role),
          status: v.status === 'flight-ready' ? 'Flight Ready' : 'In Concept',
        })),
    };
  });

  const toggle = (key) => (ui.role = ui.role === key ? null : key);
</script>

<h3 class="section-title" style="margin-top:22px">Roles</h3>
<p class="muted org-intro">
  {#if d.missing}No ships for: <strong>{d.missing}</strong>.{/if}
  {#if d.concept}Only in-concept ships for: <strong>{d.concept}</strong>.{/if}
  {#if !d.missing && !d.concept}Every role is covered.{/if}
  Click a role to see what fills it.
</p>
<div class="role-chips">
  {#each d.chips as r (r.key)}
    <button
      type="button"
      class="role-chip {r.cls}{ui.role === r.key ? ' open' : ''}"
      data-role={r.key}
      aria-expanded={ui.role === r.key}
      title={r.cls === 'concept' ? 'Covered by ships that are still in concept' : undefined}
      onclick={() => toggle(r.key)}
      >{r.label}{#if r.count}{' '}<b>{r.count}</b>{/if}</button
    >
  {/each}
</div>
{#if panel}
  <div class="org-panel">
    <div class="org-panel-head">
      <strong>{panel.r.label}</strong> ·
      {#if panel.r.count}
        {panel.r.count} ship{panel.r.count === 1 ? '' : 's'}
      {:else}
        nobody has one yet
      {/if}
      <button
        type="button"
        class="org-close"
        data-close="role"
        aria-label="Close"
        onclick={() => (ui.role = null)}>×</button
      >
    </div>
    {#if panel.ships}
      <table class="org-table">
        <thead>
          <tr>
            <th>Ship</th><th>Role</th><th>Status</th><th class="num">Count</th><th>Owners</th>
          </tr>
        </thead>
        <tbody>
          {#each panel.ships as sh}
            <tr>
              <td>{sh.name}</td>
              <td class="muted">{sh.role}</td>
              <td>
                {#if sh.status === 'flight-ready'}
                  <span class="badge good">Flight Ready</span>
                {:else}
                  <span class="badge warn">In Concept</span>
                {/if}
              </td>
              <td class="num">{sh.count}</td>
              <td class="org-owners">{sh.owners}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if panel.options.length}
      <p class="muted org-intro">Every ship that fills this role, cheapest first:</p>
      <div class="org-scroll">
        <table class="org-table">
          <thead>
            <tr><th>Ship</th><th>Role</th><th>Status</th></tr>
          </thead>
          <tbody>
            {#each panel.options as v}
              <tr>
                <td>{v.name}</td>
                <td class="muted">{v.role}</td>
                <td class="muted">{v.status}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="muted">No ships in the ship list fill this role.</p>
    {/if}
  </div>
{/if}
