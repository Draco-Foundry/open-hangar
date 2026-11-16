<script>
  // One opt-in switch row: its name, the switch, and any lines under it (`children`).
  // The popup's Settings tab draws every opt-in with it (Auto Scan Daily, the Daily
  // Scan Reminder, Notifications, Account History, Order History), and so does the
  // first-run setup, so the same switch looks the same everywhere (One Display).
  // `id`: the base of the ids (`${id}-l` the name, `${id}-sw` the switch); `rowId` the
  // row's own id, if it has one; `sub`: a row inside a group (tighter); `describedby`:
  // the ids of the lines that describe it. `tip`: the switch's reason, behind an ⓘ
  // button (a tap or a click opens it, as a line under the row; owner, 2026-11-15:
  // names and switches only, reasons in a tip); `tipOpen` and `ontip` hold it open.
  // Its look is ./opt-in-row.css, which each page
  // that shows it imports into its own stylesheet (a component's own style block would land
  // in ui/shared.css, which the popup and the basic page don't load).
  let {
    id,
    rowId = null,
    label,
    on = false,
    sub = false,
    disabled = false,
    describedby = null,
    tip = '',
    tipOpen = false,
    ontip,
    onclick,
    children,
  } = $props();
</script>

<div class="pp-r pp-col" class:pp-sub={sub} id={rowId}>
  <div class="pp-line">
    <span class="pp-grow" id="{id}-l">{label}</span>
    {#if tip}
      <button
        type="button"
        class="oh-tip"
        id="{id}-tip-btn"
        aria-expanded={tipOpen}
        aria-controls="{id}-tip"
        aria-label={label}
        onclick={ontip}>i</button
      >
    {/if}
    <button
      type="button"
      role="switch"
      class="pp-sw"
      id="{id}-sw"
      aria-checked={on}
      aria-labelledby="{id}-l"
      aria-describedby={[describedby, tip && tipOpen && `${id}-tip`].filter(Boolean).join(' ') ||
        null}
      {disabled}
      {onclick}><i></i></button
    >
  </div>
  {#if tip && tipOpen}<p class="oh-tip-text" id="{id}-tip">{tip}</p>{/if}
  {@render children?.()}
</div>
