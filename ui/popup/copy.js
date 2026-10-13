// Every new word the popup shows, in one place: the owner's approved words
// (2026-10-13), word for word. The note beside each says what it's for. Words the
// extension already uses elsewhere (Account Value, Open My Hangar, Connect to
// openhangar.space) are used as they are, not repeated here. {name} parts are filled
// in by t().
const COPY = {
  // The value's label before ship prices load: the pledges' melt total for now.
  'popup.melt-label': 'Melt Value',
  // Under the value: no scan yet in this browser; points at the Scan button.
  'popup.no-scan': 'No scan in this browser yet. Press Scan to read your hangar.',
  // When the hangar was last scanned, e.g. "today, 5:54 PM".
  'popup.last-scan': 'Scanned {when}',
  // The last scan is a week old or more (the toolbar badge's "!"): a nudge to scan.
  'popup.stale': 'Last scan {days} days ago. Time for a fresh one.',
  // A scan is running in the extension's page right now.
  'popup.scanning': "Scanning now. Keep the Open Hangar tab open until it's done.",
  // The Scan button (opens the extension's page, which runs the scan).
  'popup.scan': 'Scan',
  // Scan pressed while one is already running or was just asked for.
  'popup.scan-busy': 'A scan is already running.',
  // --- Store alerts (the `alerts` flag, ./Alerts.svelte) ---
  // The list's heading: how many items in RSI's store are alerts for you, e.g. "3 Alerts".
  'popup.alerts': 'Alerts: {n}',
  // Alerts on, nothing for you in the store right now.
  'popup.alerts-none': "Nothing in RSI's store for you right now.",
  // Read by screen readers before an alert you hadn't seen yet (shown with a dot).
  'popup.alerts-unseen': 'Not seen yet:',
  // Alerts on, not connected: only the hangar's rules run; connecting adds your
  // account's Wishlist (read on this device, never sent back).
  'popup.alerts-connect':
    "Connect to openhangar.space to add your Wishlist. It's read on this device and never sent back.",
  // Alerts off: what they'd do in one line (matched here, nothing about you sent).
  'popup.alerts-off':
    "Alerts tell you when something in RSI's store is for you. They're matched on this device, and nothing about you is sent.",
  // The link to the settings switch that turns them on (Title Case).
  'popup.alerts-turn-on': 'Turn On Alerts',
  // Connected to openhangar.space: as whom, and when it last synced.
  'popup.connected': 'Connected as {name}',
  'popup.synced': 'Synced {when}',
  'popup.not-synced': 'Not synced yet',
  // The website took a sync for this account moments ago (too soon): calm, never an
  // error code; the next one can go at {time} ("6:02 PM"). The owner's words start
  // "try again at ..." (#570).
  'popup.sync-wait': 'Try again at {time}. The last sync was moments ago.',
  // Not connected: the hangar stays in this browser; Connect is optional.
  'popup.not-connected': 'Your hangar stays in this browser. Connecting is optional.',
  // Signed out of RSI: Scan needs you logged in on robertsspaceindustries.com.
  'popup.signed-out': 'Log in on robertsspaceindustries.com to scan.',
  // The link to the extension's own page: pledges, buy-backs, export and settings.
  'popup.open-page': 'Open Pledges and Settings',
};

export function t(key, vars = {}) {
  const s = COPY[key];
  if (s == null) throw new Error(`popup copy: no "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
