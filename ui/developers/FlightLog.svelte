<script>
  // Developers → Flight Log (#315): copy it, clear the log, and a preview of exactly
  // what gets copied (filled while it's open). The log itself is OH.errorReport().
  import { app, OH } from '../lib/app.svelte.js';

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
    const ok = await app().dev.copyFlightLog();
    msg = ok
      ? 'Flight log copied. Drop it in #bug-reports and the engineers will suit up.'
      : "Copy failed. Open See Exactly What Gets Copied below and copy it by hand.";
    refresh();
  }
  async function clear() {
    await OH().clearLog();
    msg = 'Log cleared.';
    refresh();
  }
</script>

<div class="data-actions">
  <button id="copy-report" type="button" onclick={copy}>Copy Flight Log</button>
  <button id="clear-log" type="button" class="btn-secondary" onclick={clear}>Clear Log</button>
</div>
<div id="report-msg" class="muted">{msg}</div>
<details id="report-preview" class="report-preview" ontoggle={toggled}>
  <summary>See Exactly What Gets Copied</summary>
  <pre id="report-text">{text}</pre>
</details>
