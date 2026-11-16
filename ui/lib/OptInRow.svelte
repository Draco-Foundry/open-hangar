<script>
  // One opt-in switch row: its name, the switch, and any lines under it (`children`).
  // The popup's Settings tab draws every opt-in with it (Auto Scan Daily, the Daily
  // Scan Reminder, Notifications, Account History, Order History), and so does the
  // first-run setup, so the same switch looks the same everywhere (One Display).
  // `id`: the base of the ids (`${id}-l` the name, `${id}-sw` the switch); `rowId` the
  // row's own id, if it has one; `sub`: a row inside a group (tighter); `describedby`:
  // the ids of the lines that describe it.
  let {
    id,
    rowId = null,
    label,
    on = false,
    sub = false,
    disabled = false,
    describedby = null,
    onclick,
    children,
  } = $props();
</script>

<div class="pp-r pp-col" class:pp-sub={sub} id={rowId}>
  <div class="pp-line">
    <span class="pp-grow" id="{id}-l">{label}</span>
    <button
      type="button"
      role="switch"
      class="pp-sw"
      id="{id}-sw"
      aria-checked={on}
      aria-labelledby="{id}-l"
      aria-describedby={describedby || null}
      {disabled}
      {onclick}><i></i></button
    >
  </div>
  {@render children?.()}
</div>

<style>
  .pp-line {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pp-sw {
    position: relative;
    flex: none;
    width: 34px;
    height: 19px;
    border-radius: 10px;
    border: 0;
    padding: 0;
    background: var(--line-2);
    cursor: pointer;
  }
  .pp-sw i {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.15s ease;
  }
  .pp-sw[aria-checked='true'] {
    background: var(--accent);
  }
  .pp-sw[aria-checked='true'] i {
    left: 17px;
  }
  .pp-sw:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
