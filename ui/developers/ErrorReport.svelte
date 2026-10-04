<script>
  // Developers → Error Report: copy it, clear the log, and a preview of exactly what
  // gets copied (filled while it's open). The report itself is OH.errorReport().
  import { app, OH } from '../lib/app.svelte.js';

  const COPY = 'Copy Error Report';
  let label = $state(COPY);
  let msg = $state('');
  let open = false; // only read by refresh(), never drawn
  let text = $state('');

  async function refresh() {
    if (open) text = await OH().errorReport();
  }
  function toggled(e) {
    open = e.currentTarget.open;
    refresh();
  }
  async function copy() {
    const ok = await app().dev.copyErrorReport();
    label = ok
      ? 'Copied! Beam it to #bug-reports on Discord or a GitHub issue'
      : 'Copy failed. See Developers → Error report';
    setTimeout(() => (label = COPY), 3000);
    refresh();
  }
  async function clear() {
    await OH().clearLog();
    msg = 'Log cleared.';
    refresh();
  }
</script>

<div class="data-actions">
  <button id="copy-report" type="button" onclick={copy}>{label}</button>
  <button id="clear-log" type="button" class="btn-secondary" onclick={clear}>Clear Log</button>
</div>
<div id="report-msg" class="muted">{msg}</div>
<details id="report-preview" class="report-preview" ontoggle={toggled}>
  <summary>See Exactly What Gets Copied</summary>
  <pre id="report-text">{text}</pre>
</details>
