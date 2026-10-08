<script>
  // Org Fleet: members' ship lists (HTF exports or backups) combined into one fleet.
  // Ported from renderOrg() as it looked in 0.2.x (no signed-off redesign yet), so it
  // reuses the dashboard's classes. Ships only: no store prices or fleet values, and no
  // member's totals next to another's (CLAUDE.md, What Not to Build). The stored list
  // and the buttons' work stay in src/dashboard.js (OHApp.org); renderOrg() there fires
  // 'oh:home' when it changes.
  import { app, version } from '../lib/app.svelte.js';
  import { owners } from './text.js';
  import Bars from './Bars.svelte';
  import Roles from './Roles.svelte';
  import Members from './Members.svelte';

  let msg = $state('');
  let fileInput;

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const o = a.org;
    // Nothing to work out while another page is showing, or before the list loads.
    if (!o.active || !o.members) return null;
    const members = [...o.members];
    const s = a.state;
    if (!members.length || !s.shipOf) return { members, f: null };
    const f = o.fleet(members);
    return {
      members,
      f,
      catalog: s.catalog || [],
      boxes: [
        [f.members, 'members'],
        [f.shipCount, 'ships'],
        [Math.round(f.cargo).toLocaleString('en-US'), 'cargo (SCU)'],
        [f.crew.toLocaleString('en-US'), 'crew seats'],
      ],
      biggest: f.biggest.map((r) => ({
        ...r,
        size: o.titleCase(r.size),
        owners: owners(r.owners),
      })),
      ships: f.ships.map((r) => ({ ...r, owners: owners(r.owners) })),
    };
  });

  async function onFiles(e) {
    const files = [...(e.currentTarget.files || [])];
    e.currentTarget.value = '';
    msg = await app().org.importFiles(files);
  }
  async function addMine() {
    msg = await app().org.addMine();
  }
  async function exportCsv() {
    msg = await app().org.exportCsv();
  }
</script>

<h2 class="section-title">Org Fleet</h2>
<p class="muted org-intro">
  Put your org's hangars together into one fleet. Each member opens Open Hangar, goes to
  <strong>Developers → Export HTF</strong> (ships only, nothing personal) and sends you the file.
  Import them here. Full backups work too, but only the ships are read. Everything stays in this
  browser.
</p>
<div class="org-actions">
  <button id="org-import" type="button" onclick={() => fileInput.click()}>
    Import Member Files…
  </button>
  <button id="org-mine" type="button" class="btn-secondary" onclick={addMine}>Add My Fleet</button>
  <button id="org-csv" type="button" class="btn-secondary" onclick={exportCsv}>Export CSV</button>
  <input
    id="org-file"
    type="file"
    accept="application/json,.json"
    multiple
    hidden
    bind:this={fileInput}
    onchange={onFiles}
  />
  <span id="org-msg" class="muted" aria-live="polite">{msg}</span>
</div>

<div id="org-body">
  {#if d && !d.members.length}
    <div class="empty">
      No org fleet assembled yet. Import member files, or start with <strong>Add My Fleet</strong>.
    </div>
  {:else if d}
    <Members members={d.members} ready={!!d.f} />
    {#if !d.f}
      <p class="muted">Loading ship data…</p>
    {:else}
      <div class="stat-grid">
        {#each d.boxes as [big, lbl]}
          <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
        {/each}
      </div>
      <Roles f={d.f} catalog={d.catalog} />
      {#if d.biggest.length}
        <h3 class="section-title" style="margin-top:22px">Biggest Ships</h3>
        <table class="org-table">
          <thead>
            <tr>
              <th>Ship</th><th>Size</th><th class="num">Count</th><th>Owners</th>
            </tr>
          </thead>
          <tbody>
            {#each d.biggest as r}
              <tr>
                <td>{r.name}</td>
                <td>{r.size}</td>
                <td class="num">{r.count}</td>
                <td class="org-owners">{r.owners}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      <div class="fleet-cols">
        <div><h4 class="modal-h">By Role</h4><Bars map={d.f.byCareer} /></div>
        <div><h4 class="modal-h">By Size</h4><Bars map={d.f.bySize} /></div>
      </div>
      <h3 class="section-title" style="margin-top:22px">Ships</h3>
      <table class="org-table">
        <thead>
          <tr>
            <th>Ship</th><th class="num">Count</th><th class="num">LTI</th><th>Owners</th>
          </tr>
        </thead>
        <tbody>
          {#each d.ships as r}
            <tr>
              <td>{r.name}</td>
              <td class="num">{r.count}</td>
              <td class="num">{r.lti}</td>
              <td class="org-owners">{r.owners}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</div>
