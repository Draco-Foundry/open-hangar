// Every word the popup shows, in one place: the owner's approved words, word for word.
// The note beside each says what it's for. Words the extension already uses elsewhere
// (Account Value, Store Credit, Buy-Back Tokens, Open My Hangar, Connect to
// openhangar.space, Sync Now, Disconnect, Export JSON, Export CSV, Saved Accounts, Log
// Out of RSI, Clear Data, Report a Scan Problem) are used as they are, not repeated
// here; the basic page's that the popup now shows too are copied below with a note.
// {name} parts are filled in by t(), and a key's '.one' words stand in when {n} is 1.
// Headings, buttons and links in Title Case. A word marked "NEW: needs the owner's OK"
// is from the approved mockups (2026-10-14) or new for this release, and waits for the
// owner's sign-off.
const COPY = {
  // --- Header ---
  // The scan-age dot's line: how long ago the hangar was scanned ("2h ago").
  'popup.ago-m': '{n}m ago', // NEW: needs the owner's OK
  'popup.ago-h': '{n}h ago', // NEW: needs the owner's OK
  'popup.ago-d': '{n}d ago', // NEW: needs the owner's OK
  'popup.never': 'Not scanned', // NEW: needs the owner's OK (no scan in this browser yet)
  // A scan running: the basic page's word for it (basic.scanning), word for word.
  'popup.scanning-short': 'Scanning',
  'popup.stopped': 'Scan stopped', // NEW: needs the owner's OK (the scan didn't finish)
  // The bell: its name for screen readers, and with a count the old list's heading
  // (popup.alerts, approved 2026-10-13).
  'popup.bell': 'Alerts', // NEW: needs the owner's OK (also the bell view's heading)
  'popup.back': 'Back', // NEW: needs the owner's OK (the bell view's ‹, for screen readers)
  // What's new after an update, once per version: the dot on the version tag opens it.
  'popup.new-in': 'New in {version}', // NEW: needs the owner's OK
  'popup.what-changed': 'See What Changed ↗', // NEW: needs the owner's OK
  'popup.got-it': 'Got It', // NEW: needs the owner's OK
  // --- Tabs ---
  // The tab row's name for screen readers: the basic page's (basic.tabs), word for word.
  'popup.tabs': 'Hangar sections',
  'popup.tab-hangar': 'Hangar', // NEW: needs the owner's OK
  'popup.tab-wishlist': 'Wishlist', // NEW: needs the owner's OK
  'popup.tab-settings': 'Settings', // the basic page's tab (basic.tab-settings)
  // --- Hangar tab ---
  // The value's label before ship prices load: the pledges' melt total for now.
  'popup.melt-label': 'Melt Value',
  // The change in Account Value since an earlier scan: "▲ $120 since Oct 12".
  'popup.up-since': '▲ {amount} since {date}', // NEW: needs the owner's OK
  'popup.down-since': '▼ {amount} since {date}', // NEW: needs the owner's OK
  // Beside the buy-back token count: when RSI hands out the next one ("next Jan 4").
  'popup.token-next': 'next {date}', // NEW: needs the owner's OK
  'popup.fleet-news': 'Fleet News', // NEW: needs the owner's OK (heading)
  'popup.all-alerts': 'All Alerts →', // NEW: needs the owner's OK (opens the bell view)
  // The Scan button (asks the background, which runs the scan).
  'popup.scan': 'Scan',
  // Scan pressed while one is already running or was just asked for.
  'popup.scan-busy': 'A scan is already running.',
  // A scan running in the Open Hangar tab (an older way to scan, still the fallback).
  'popup.scanning': "Scanning now. Keep the Open Hangar tab open until it's done.",
  'popup.scan-again': 'Scan Again', // NEW: needs the owner's OK (after a scan stopped)
  // Before the first scan: no tabs, one heading and Scan.
  'popup.first': 'Your Hangar, in One Scan', // NEW: needs the owner's OK
  // Signed out of RSI: the big button to RSI's sign-in page (a grey Scan under it).
  'popup.log-in': 'Log In to RSI ↗', // NEW: needs the owner's OK
  // The scan's steps, the basic page's names for its parts, word for word.
  'popup.step-hangar': 'Hangar',
  'popup.step-buybacks': 'Buy-Backs',
  'popup.step-referrals': 'Referrals',
  // Shown once after a scan: how long it took ("Scanned in 38s", "Scanned in 2m 5s").
  'popup.scanned-in-s': 'Scanned in {s}s', // NEW: needs the owner's OK
  'popup.scanned-in-m': 'Scanned in {m}m {s}s', // NEW: needs the owner's OK
  // A scan with a problem: the basic page's title (basic.scan-problem), word for word.
  'popup.scan-problem': 'The Scan Ran Into Trouble',
  // A part read only in part, in the problem box ("Hangar: 42 pledges"): the basic
  // page's row words (basic.row-pledges, basic.row-buybacks, basic.row-referrals-box),
  // word for word.
  'popup.row-pledges': '{n} pledges',
  'popup.row-pledges.one': '{n} pledge',
  'popup.row-buybacks': '{n} buy-backs',
  'popup.row-buybacks.one': '{n} buy-back',
  'popup.row-referrals': 'read',
  // A different RSI account signed in: the basic page's words, word for word.
  'popup.switched-back': "Signed in as {who} on RSI: that account's saved hangar is back.",
  'popup.switched-new': 'Signed in as {who} on RSI: that account has no scan here yet. Press Scan.',
  // --- The bell's Alerts view (the `alerts` flag, ./Alerts.svelte) ---
  'popup.alerts': 'Alerts: {n}', // the bell's name with a count
  'popup.alerts-new': 'New', // NEW: needs the owner's OK (alerts you hadn't seen)
  'popup.alerts-earlier': 'Earlier', // NEW: needs the owner's OK (the ones seen before)
  // Alerts on, nothing for you in the store right now.
  'popup.alerts-none': "Nothing in RSI's store for you right now.",
  // Read by screen readers before an alert you hadn't seen yet.
  'popup.alerts-unseen': 'Not seen yet:',
  // Alerts on, not connected: only the hangar's rules run; connecting adds your
  // account's Wishlist (read on this device, never sent back).
  'popup.alerts-connect':
    "Connect to openhangar.space to add your Wishlist. It's read on this device and never sent back.",
  'popup.open-store': 'Open the Store ↗', // NEW: needs the owner's OK (our Store)
  'popup.alerts-off-title': 'Store Alerts Are Off', // NEW: needs the owner's OK
  'popup.alerts-turn-on': 'Turn On Alerts',
  // --- Wishlist tab ---
  'popup.wish-count': 'Your Wishlist · {n}', // NEW: needs the owner's OK
  'popup.wish-on-sale': 'On Sale', // NEW: needs the owner's OK
  'popup.wish-not-sale': 'Not for Sale', // NEW: needs the owner's OK
  // Items the store list can't name here, shown on the website.
  'popup.wish-more': 'And {n} more', // NEW: needs the owner's OK
  'popup.wish-empty': 'Your Wishlist Is Empty', // NEW: needs the owner's OK
  'popup.wish-trouble': "Couldn't Reach openhangar.space", // NEW: needs the owner's OK
  'popup.wish-full': 'Full Wishlist ↗', // NEW: needs the owner's OK
  // Not connected, or store alerts off (the popup reads the Wishlist only through the
  // alerts, as the privacy policy says): the Wishlist lives on the website.
  'popup.wish-connect': 'Your Wishlist Lives on openhangar.space', // NEW: needs the owner's OK
  // --- Settings tab ---
  // Connected to openhangar.space: as whom, and when it last synced.
  'popup.connected': 'Connected as {name}',
  'popup.synced': 'Synced {when}',
  'popup.not-synced': 'Not synced yet',
  'popup.syncing': 'Syncing now', // the basic page's (basic.syncing), word for word
  // The website took a sync for this account moments ago (too soon): calm, never an
  // error code; the next one can go at {time} ("6:02 PM"). The owner's words start
  // "try again at ..." (#570).
  'popup.sync-wait': 'Try again at {time}. The last sync was moments ago.',
  'popup.sync-trouble': "Last Sync Didn't Go Through", // NEW: needs the owner's OK
  // Firefox said no to sharing: the basic page's words (basic.firefox-no), word for word.
  'popup.firefox-no': 'Firefox said no, so sync stays off.',
  // A new RSI account on a connected browser: the basic page's words, word for word.
  'popup.pilot-title': 'Sync {handle} Too?',
  'popup.pilot-body':
    "It hasn't synced to your openhangar.space account before. Syncing adds its hangar there too.",
  'popup.pilot-yes': 'Sync It',
  'popup.pilot-no': 'Not This One',
  // Disconnect's question: the dashboard's, word for word (ui/site/YouDisconnect.svelte).
  'popup.disconnect-ask': 'Disconnect From openhangar.space?',
  'popup.disconnect-body':
    'Your synced copy stays on openhangar.space until you delete it there. This extension just stops syncing.',
  'popup.stay': 'Stay Connected',
  // A daily scan while connected (the `autoScan` flag, off until it's built).
  'popup.auto-scan': 'Auto Scan Daily', // NEW: needs the owner's OK
  'popup.store-alerts': 'Store Alerts', // the basic page's heading (basic.alerts-title)
  'popup.notifications': 'Notifications', // NEW: needs the owner's OK (the switch's name)
  'popup.look': 'Look', // NEW: needs the owner's OK
  'popup.look-auto': 'Match Browser', // NEW: needs the owner's OK
  'popup.look-dark': 'Dark', // NEW: needs the owner's OK
  'popup.look-light': 'Light', // NEW: needs the owner's OK
  'popup.currency': 'Currency', // NEW: needs the owner's OK
  'popup.shortcut': 'Shortcut', // NEW: needs the owner's OK
  'popup.shortcut-none': 'Not Set', // NEW: needs the owner's OK (no shortcut set)
  'popup.shortcut-change': 'Change ↗', // NEW: needs the owner's OK (the browser's page)
  // The basic page's words for the data buttons, word for word.
  'popup.json-saved': 'Backup saved.',
  'popup.csv-saved': 'Saved {n} rows to a CSV file.',
  'popup.csv-saved.one': 'Saved {n} row to a CSV file.',
  'popup.clear-ask':
    'Clear all saved data from this browser? Export a backup first if you might want it.',
  'popup.keep-data': 'Keep It',
  'popup.cleared': 'Saved data cleared from this browser.',
  'popup.account-line': '{n} pledges, last scan {when}',
  'popup.account-line.one': '{n} pledge, last scan {when}',
  'popup.account-live': 'Signed In',
  'popup.account-remove': 'Remove',
  'popup.account-remove-ask': "Remove this account's saved hangar from this browser?",
  'popup.logged-out': 'Logged out of RSI.',
  'popup.logout-failed': "Couldn't log out of RSI. Try again, or log out on RSI's site.",
  // The links at the bottom.
  'popup.help': 'Help', // NEW: needs the owner's OK
  'popup.privacy': 'Privacy', // NEW: needs the owner's OK
};

export function t(key, vars = {}) {
  const s = (vars.n === 1 && COPY[`${key}.one`]) || COPY[key];
  if (s == null) throw new Error(`popup copy: no "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
export const KEYS = Object.keys(COPY);
