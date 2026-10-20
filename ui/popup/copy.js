// Every word the popup shows, in one place: the owner's approved words, word for word.
// The note beside each says what it's for. Words the extension already uses elsewhere
// (Account Value, Store Credit, Buy-Back Tokens, Open My Hangar, Connect to
// openhangar.space, Sync Now, Disconnect, Saved Accounts, Log Out of RSI, Clear Data,
// Report a Scan Problem) are used as they are, not repeated here; the basic page's that
// the popup now shows too are copied below with a note.
// {name} parts are filled in by t(), and a key's '.one' words stand in when {n} is 1.
// Headings, buttons and links in Title Case. Everything here is approved (the owner,
// 2026-10-14) except a word marked "NEW: needs the owner's OK", which waits for the
// owner's sign-off.
const COPY = {
  // --- Header ---
  // The scan-age dot's line: how long ago the hangar was scanned ("2h ago").
  'popup.ago-m': '{n}m ago',
  'popup.ago-h': '{n}h ago',
  'popup.ago-d': '{n}d ago',
  'popup.never': 'Not scanned', // no scan in this browser yet
  // A scan running: the basic page's word for it (basic.scanning), word for word.
  'popup.scanning-short': 'Scanning',
  'popup.stopped': 'Scan stopped', // the scan didn't finish
  // The bell: its name for screen readers, and with a count the old list's heading
  // (popup.alerts, approved 2026-10-13).
  'popup.bell': 'Alerts', // also the bell view's heading
  'popup.back': 'Back', // the bell view's ‹, for screen readers
  // What's new after an update, once per version: the dot on the version tag opens it.
  'popup.new-in': 'New in {version}',
  'popup.what-changed': 'See What Changed ↗',
  'popup.got-it': 'Got It',
  // A new version the browser holds until it's let in (src/background.js updateReady):
  // the basic page's words (basic.update-ready, basic.update-reload), word for word.
  'popup.update-ready': 'Open Hangar {version} is ready.',
  'popup.update-reload': 'Reload to Update',
  // --- Tabs ---
  // The tab row's name for screen readers: the basic page's (basic.tabs), word for word.
  'popup.tabs': 'Hangar sections',
  'popup.tab-hangar': 'Hangar',
  'popup.tab-wishlist': 'Wishlist',
  'popup.tab-settings': 'Settings', // the basic page's tab (basic.tab-settings)
  // --- Hangar tab ---
  // The value's label before ship prices load: the pledges' melt total for now.
  'popup.melt-label': 'Melt Value',
  // The change in Account Value since an earlier scan: "▲ $120 since Oct 12".
  'popup.up-since': '▲ {amount} since {date}',
  'popup.down-since': '▼ {amount} since {date}',
  // Beside the buy-back token count: when RSI hands out the next one ("Next refill Jan 4").
  'popup.token-next': 'Next refill {date}',
  'popup.fleet-news': 'Fleet News', // heading
  'popup.all-alerts': 'All Alerts →', // opens the bell view
  // Fleet News with store alerts on and nothing for your ships or your Wishlist.
  'popup.fleet-news-none': 'No news for your ships right now.',
  // The Scan button (asks the background, which runs the scan).
  'popup.scan': 'Scan',
  // Scan pressed while one is already running or was just asked for.
  'popup.scan-busy': 'A scan is already running.',
  // A scan running in the Open Hangar tab (an older way to scan, still the fallback).
  'popup.scanning': "Scanning now. Keep the Open Hangar tab open until it's done.",
  'popup.scan-again': 'Scan Again', // after a scan stopped
  // The line at the top after a scan stopped partway (approved 2026-10-18): signed out
  // of RSI, or anything else (with Scan Again).
  'popup.stop-out':
    "Your Last Scan Stopped Because You're Signed Out of RSI. Sign In and Scan Again.",
  'popup.stop-partway':
    'Your Last Scan Stopped Before It Finished. Your Hangar Shows the Last Full Scan.',
  // Before the first scan: no tabs, one heading and Scan.
  'popup.first': 'Your Hangar, in One Scan',
  // Signed out of RSI: the big button to RSI's sign-in page (a grey Scan under it).
  'popup.log-in': 'Log In to RSI ↗',
  // The scan's steps, the basic page's names for its parts, word for word.
  'popup.step-hangar': 'Hangar',
  'popup.step-buybacks': 'Buy-Backs',
  'popup.step-referrals': 'Referrals',
  // Shown once after a scan: how long it took ("Scanned in 38s", "Scanned in 2m 5s").
  'popup.scanned-in-s': 'Scanned in {s}s',
  'popup.scanned-in-m': 'Scanned in {m}m {s}s',
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
  'popup.alerts-new': 'New', // alerts you hadn't seen
  'popup.alerts-earlier': 'Earlier', // the ones seen before
  // Alerts on, nothing for you in the store right now.
  'popup.alerts-none': "Nothing in RSI's store for you right now.",
  // Read by screen readers before an alert you hadn't seen yet.
  'popup.alerts-unseen': 'Not seen yet:',
  // Alerts on, not connected: only the hangar's rules run; connecting adds your
  // account's Wishlist (read on this device, never sent back).
  'popup.alerts-connect':
    "Connect to openhangar.space to add your Wishlist. It's read on this device and never sent back.",
  'popup.open-store': 'Open the Store ↗', // our Store
  'popup.alerts-off-title': 'Store Alerts Are Off',
  'popup.alerts-turn-on': 'Turn On Alerts',
  // Deleting alerts (#701): each row's ×, for screen readers, and the list's Clear All
  // (approved 2026-10-16).
  'popup.alerts-delete': 'Delete {name}',
  'popup.alerts-clear': 'Clear All',
  // --- Wishlist tab ---
  'popup.wish-count': 'Your Wishlist · {n}',
  'popup.wish-on-sale': 'On Sale',
  'popup.wish-not-sale': 'Not for Sale',
  // Items the store list can't name here, shown on the website.
  'popup.wish-more': 'And {n} more',
  'popup.wish-empty': 'Your Wishlist Is Empty',
  // The Wishlist couldn't be read, or a change to it didn't go through.
  'popup.wish-trouble': "Couldn't Reach openhangar.space",
  'popup.wish-full': 'Full Wishlist ↗',
  // Not connected, or the website's Wishlist is off for this account: the Wishlist
  // lives on the website.
  'popup.wish-connect': 'Your Wishlist Lives on openhangar.space',
  // The search box's placeholder (and its name for screen readers): searched on this
  // device, never sent.
  'popup.wish-search': 'Add a ship, paint or upgrade',
  // The same with store alerts off: ships only (paints and upgrades come with the alerts'
  // sale feed).
  'popup.wish-search-ships': 'Add a ship',
  // Under the search box: what's typed is searched and nothing matched.
  'popup.wish-no-match': 'No matches.',
  // The ✕ beside an item, for screen readers.
  'popup.wish-remove': 'Remove {name}',
  // Remind Me on each item (the website's wishlist_remind): the switch's label (its
  // title; on or off shows in the switch itself) and its name for screen readers (on or
  // off is read out on its own). Approved 2026-10-16.
  'popup.wish-remind-label': 'Remind Me',
  'popup.wish-remind': 'Remind me about {name}',
  // The field for the price you're waiting for, in US dollars.
  // The website didn't take an add (it couldn't place the item, or the list is full).
  'popup.wish-not-added': "Couldn't add {name}.",
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
  'popup.sync-trouble': "Last Sync Didn't Go Through",
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
  // A daily scan while connected (the `autoScan` flag): its switch, in the
  // openhangar.space group.
  'popup.auto-scan': 'Auto Scan Daily',
  // Its status line under the switch, one at a time (ui/popup/data.js autoLine): before
  // its first run, a quick check that found nothing new (or a full read that found
  // nothing different), a full scan saved with something new, a day skipped (signed out
  // of RSI, another RSI account signed in, scans paused).
  'popup.auto-first': 'Runs once a day while your browser is open.',
  'popup.auto-quick': 'Last: {when}, no changes',
  'popup.auto-full': 'Last: {when}, hangar updated',
  'popup.auto-signed-out': 'Skipped {when}: signed out of RSI',
  'popup.auto-other': 'Skipped {when}: a different RSI account is signed in',
  'popup.auto-paused': 'Skipped {when}: scans are paused',
  // A part thrown away: only when it came back as another account, or with a sudden
  // drop. Not for a part RSI stopped answering partway (auto-stopped is).
  'popup.auto-bad': "Last: {when}, something looked wrong and wasn't saved. Scan to check.",
  // A part that didn't finish because RSI stopped answering partway (the run's line
  // 'partway': a page it couldn't read, too).
  'popup.auto-stopped': 'Last: {when}, RSI stopped answering partway. Scan to check.',
  // A part that didn't finish because the pilot signed out of RSI midway (the run's line
  // 'out-partway'). Claude chat, 2026-10-14 22:00 UTC.
  'popup.auto-out-partway': 'Last: {when}, signed out of RSI partway. Scan to check.',
  // {when} on the day it ran: "today 6:12 AM" (another day: "Oct 13, 6:12 AM").
  'popup.auto-today': 'today {time}',
  'popup.store-alerts': 'Store Alerts', // the basic page's heading (basic.alerts-title)
  'popup.notifications': 'Notifications', // the switch's name
  'popup.look': 'Look',
  'popup.look-auto': 'Match Browser',
  'popup.look-dark': 'Dark',
  'popup.look-light': 'Light',
  'popup.currency': 'Currency',
  'popup.shortcut': 'Shortcut',
  'popup.shortcut-none': 'Not Set', // no shortcut set
  'popup.shortcut-change': 'Change ↗', // the browser's page
  // The data buttons: the backup file, and a CSV of your pledges or your buy-backs.
  'popup.export-json': 'JSON Backup',
  'popup.export-pledges': 'Pledges CSV',
  'popup.export-buybacks': 'Buy-Backs CSV',
  // The basic page's words for what the data buttons did, word for word.
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
  'popup.help': 'Help',
  'popup.privacy': 'Privacy',
};

export function t(key, vars = {}) {
  const s = (vars.n === 1 && COPY[`${key}.one`]) || COPY[key];
  if (s == null) throw new Error(`popup copy: no "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
export const KEYS = Object.keys(COPY);
// The words still waiting for the owner's OK (marked beside them above).
export const NEW_WORDS = [];
