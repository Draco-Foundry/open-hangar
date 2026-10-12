// Every new word the popup shows, in one place. Each is a placeholder until Claude
// chat writes it and the owner approves it (CLAUDE.md); the note beside each says
// what it must say. Words the extension already uses elsewhere (Account Value, Open My
// Hangar, Connect to openhangar.space) are used as they are, not repeated here.
// {name} parts are filled in by t().
const COPY = {
  // The value's label before ship prices load: the pledges' melt total for now.
  'popup.melt-label': '[copy: popup.melt-label]',
  // Under the value, when some pledges have no price (no store price and no melt
  // value): they're not in the total. {n} is how many, 1 or more.
  'popup.unpriced': '[copy: popup.unpriced {n}]',
  // Under the value: no scan yet in this browser; points at the Scan button.
  'popup.no-scan': '[copy: popup.no-scan]',
  // When the hangar was last scanned, e.g. "today, 5:54 PM".
  'popup.last-scan': '[copy: popup.last-scan {when}]',
  // The last scan is a week old or more (the toolbar badge's "!"): a nudge to scan.
  'popup.stale': '[copy: popup.stale {days}]',
  // A scan is running in the extension's page right now.
  'popup.scanning': '[copy: popup.scanning]',
  // The Scan button (opens the extension's page, which runs the scan).
  'popup.scan': '[copy: popup.scan]',
  // Scan pressed while one is already running or was just asked for.
  'popup.scan-busy': '[copy: popup.scan-busy]',
  // --- Store alerts (the `alerts` flag, ./Alerts.svelte) ---
  // The list's heading: how many items in RSI's store are alerts for you, e.g. "3 Alerts".
  'popup.alerts': '[copy: popup.alerts {n}]',
  // Alerts on, nothing for you in the store right now.
  'popup.alerts-none': '[copy: popup.alerts-none]',
  // Read by screen readers before an alert you hadn't seen yet (shown with a dot).
  'popup.alerts-unseen': '[copy: popup.alerts-unseen]',
  // Alerts on, not connected: only the hangar's rules run; connecting adds your
  // account's Wishlist (read on this device, never sent back).
  'popup.alerts-connect': '[copy: popup.alerts-connect]',
  // Alerts off: what they'd do in one line (matched here, nothing about you sent).
  'popup.alerts-off': '[copy: popup.alerts-off]',
  // The link to the settings switch that turns them on (Title Case).
  'popup.alerts-turn-on': '[copy: popup.alerts-turn-on]',
  // Connected to openhangar.space: as whom, and when it last synced.
  'popup.connected': '[copy: popup.connected {name}]',
  'popup.synced': '[copy: popup.synced {when}]',
  'popup.not-synced': '[copy: popup.not-synced]',
  // The website took a sync for this account moments ago (too soon): calm, never an
  // error code; the next one can go at {time} ("6:02 PM"). The owner's words start
  // "try again at ..." (#570).
  'popup.sync-wait': '[copy: popup.sync-wait {time}]',
  // Not connected: the hangar stays in this browser; Connect is optional.
  'popup.not-connected': '[copy: popup.not-connected]',
  // Signed out of RSI: Scan needs you logged in on robertsspaceindustries.com.
  'popup.signed-out': '[copy: popup.signed-out]',
  // The link to the extension's own page: pledges, buy-backs, export and settings.
  'popup.open-page': '[copy: popup.open-page]',
};

export function t(key, vars = {}) {
  const s = COPY[key];
  if (s == null) throw new Error(`popup copy: no "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
