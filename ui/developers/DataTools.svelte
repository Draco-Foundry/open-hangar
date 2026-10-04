<script>
  // Developers → export / import buttons and the note under them. The actions live in
  // src/dashboard.js (window.OHApp.dev) because they change the classic `state`.
  // Ids stay as they were: the card menus' Backup item clicks #export-db and the
  // damaged-database notice's Restore button opens #import-file.
  import { app, version } from '../lib/app.svelte.js';

  const d = $derived.by(() => {
    version.n;
    const dev = app().dev;
    return { msg: dev.msg, recovery: dev.recovery };
  });

  function picked(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = ''; // allow re-importing the same file later
    app().dev.importBackup(file);
  }
</script>

<div class="data-actions">
  <button id="export-db" onclick={() => app().dev.exportJson()}>Export JSON</button>
  <button
    id="export-htf"
    class="btn-secondary"
    title="Hangar Transfer Format: one entry per ship, for FleetYards and other SC tools"
    onclick={() => app().dev.exportHtf()}
  >
    Export HTF
  </button>
  <button
    id="import-db"
    class="btn-secondary"
    onclick={() => document.getElementById('import-file')?.click()}>Import JSON…</button
  >
  <button
    id="restore-db"
    class="btn-secondary"
    hidden={!d.recovery}
    onclick={() => app().dev.restoreBackup()}>Restore Previous Hangar</button
  >
  <input id="import-file" type="file" accept="application/json,.json" hidden onchange={picked} />
</div>
<div id="data-msg" class="muted" class:error={d.msg.error}>{d.msg.text}</div>
