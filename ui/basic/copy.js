// Every new word the basic page shows, in one place. Each is a placeholder until
// Claude chat writes it and the owner approves it (CLAUDE.md); the note beside each
// says what it must say. Words the extension already uses elsewhere (Buy-Backs,
// Export CSV, Export JSON, Clear Data, Saved Accounts, Sync Now, Disconnect, Log Out
// of RSI, Report a Scan Problem, Connect to openhangar.space, the type names) are used
// as they are, not repeated here. {name} parts are filled in by t(). Headings and
// buttons in Title Case.
const COPY = {
  // --- Page ---
  'basic.loading': '[copy: basic.loading]', // the moment before the stored hangar loads
  'basic.tabs': '[copy: basic.tabs]', // the tab row's name for screen readers
  'basic.tab-pledges': '[copy: basic.tab-pledges]', // the pledges tab and its heading
  'basic.tab-settings': '[copy: basic.tab-settings]', // the settings tab and its heading
  // --- Scan ---
  'basic.scan': '[copy: basic.scan]', // the Scan button
  'basic.scanning': '[copy: basic.scanning]', // the button while a scan runs
  'basic.scan-start': '[copy: basic.scan-start]', // first progress line, before RSI answers
  // Access to robertsspaceindustries.com is off (Firefox's add-ons page, say): the short
  // reason above the "Allow Access to RSI" button. Scan reads your hangar there, and
  // only there; one click lets it, then the scan runs.
  'basic.rsi-access-why': '[copy: basic.rsi-access-why]',
  // Progress: part is Hangar or Buy-Backs; page and count so far.
  'basic.progress': '[copy: basic.progress {part} {page} {count}]',
  'basic.progress-retry': '[copy: basic.progress-retry {part} {page} {n}/{of}]', // RSI hiccup
  'basic.progress-referrals': '[copy: basic.progress-referrals {n}]',
  'basic.row-pledges': '[copy: basic.row-pledges {n}]', // report row: pledges read
  'basic.row-buybacks': '[copy: basic.row-buybacks {n}]', // report row: buy-backs read
  'basic.row-referrals': '[copy: basic.row-referrals]', // report row: referrals read
  'basic.scan-done': '[copy: basic.scan-done]', // before the rows of a scan that went fine
  'basic.scan-problem': '[copy: basic.scan-problem]', // title of a scan with a problem
  // Signed out of RSI: nothing was scanned, your saved hangar is safe, log in on RSI.
  'basic.signed-out': '[copy: basic.signed-out]',
  // A different RSI account is signed in: its hangar is loaded (back) or needs a scan.
  'basic.switched-back': '[copy: basic.switched-back {who}]',
  'basic.switched-new': '[copy: basic.switched-new {who}]',
  // --- Lists ---
  'basic.search': '[copy: basic.search]', // the search box's hint
  'basic.pledge-totals': '[copy: basic.pledge-totals {n} {value}]', // shown pledges, melt total
  // Shown buy-backs, and the total of the ones whose price we've read.
  'basic.buyback-totals': '[copy: basic.buyback-totals {n} {value} {priced}]',
  'basic.scanned-at': '[copy: basic.scanned-at {when}]',
  'basic.no-pledges': '[copy: basic.no-pledges]', // no scan yet: points at Scan
  'basic.no-buybacks': '[copy: basic.no-buybacks]',
  'basic.no-match': '[copy: basic.no-match {q}]',
  'basic.show-all': '[copy: basic.show-all {n}]', // button: draw every row
  'basic.csv-saved': '[copy: basic.csv-saved {n}]',
  'basic.col-name': '[copy: basic.col-name]',
  'basic.col-type': '[copy: basic.col-type]',
  'basic.col-value': '[copy: basic.col-value]', // melt value
  'basic.col-insurance': '[copy: basic.col-insurance]',
  'basic.col-date': '[copy: basic.col-date]',
  'basic.col-contains': '[copy: basic.col-contains]',
  // --- Settings ---
  'basic.connect-about': '[copy: basic.connect-about]', // optional; see it on any device
  'basic.connected': '[copy: basic.connected {name}]',
  'basic.synced': '[copy: basic.synced {when}]',
  'basic.not-synced': '[copy: basic.not-synced]',
  // The website took a sync for this account moments ago (too soon): calm, never an
  // error code; Sync Now works again at {time} ("6:02 PM"). The owner's words start
  // "try again at ..." (#570). The website's own sentence shows under it.
  'basic.sync-wait': '[copy: basic.sync-wait {time}]',
  'basic.syncing': '[copy: basic.syncing]',
  'basic.connect-failed': '[copy: basic.connect-failed]', // the token trade failed: try again
  'basic.your-data': '[copy: basic.your-data]', // heading
  'basic.data-about': '[copy: basic.data-about]', // stays in this browser; backup file
  'basic.json-saved': '[copy: basic.json-saved]',
  'basic.clear-ask': '[copy: basic.clear-ask]', // are you sure; a backup first is wise
  'basic.keep-data': '[copy: basic.keep-data]', // the No to a removal
  'basic.cleared': '[copy: basic.cleared]',
  'basic.no-accounts': '[copy: basic.no-accounts]',
  'basic.account-line': '[copy: basic.account-line {n} {when}]', // pledges, last scan
  'basic.account-live': '[copy: basic.account-live]', // tag: the one signed in now
  'basic.account-remove': '[copy: basic.account-remove]',
  'basic.account-remove-ask': '[copy: basic.account-remove-ask]',
  'basic.rsi-session': '[copy: basic.rsi-session]', // heading over Log Out of RSI
  'basic.logout-about': '[copy: basic.logout-about]', // ends the RSI session; data stays
  'basic.logged-out': '[copy: basic.logged-out]',
  'basic.logout-failed': '[copy: basic.logout-failed]',
  // --- Firefox's data ask (its card's words: ui/basic/FirefoxCard.svelte) ---
  'basic.firefox-no': '[copy: basic.firefox-no]', // Firefox said no: sync stays off
  // --- A new RSI account on a connected browser ---
  'basic.pilot-title': '[copy: basic.pilot-title {handle}]',
  'basic.pilot-body': '[copy: basic.pilot-body]',
  'basic.pilot-yes': '[copy: basic.pilot-yes]',
  'basic.pilot-no': '[copy: basic.pilot-no]',
  // --- Store alerts (the `alerts` flag, ./AlertsCard.svelte) ---
  'basic.alerts-title': '[copy: basic.alerts-title]', // the card's heading (Title Case)
  // What alerts do: a badge and notifications when something in RSI's store is for
  // you (Wishlist, buy-backs, paints, warbonds, limited sales), matched in this browser
  // from one public file, nothing about you sent; a check at most every 30 minutes.
  'basic.alerts-about': '[copy: basic.alerts-about]',
  // The switch, off: turn alerts on (the browser then asks about notifications).
  'basic.alerts-turn-on': '[copy: basic.alerts-turn-on]',
  'basic.alerts-turn-off': '[copy: basic.alerts-turn-off]', // the switch, on
  // On: how many items are alerts right now, and when the store was last checked.
  'basic.alerts-on-line': '[copy: basic.alerts-on-line {n}]',
  'basic.alerts-checked': '[copy: basic.alerts-checked {when}]',
  // Notifications allowed, or not (then the badge and the popup's list only).
  'basic.alerts-notify-on': '[copy: basic.alerts-notify-on]',
  'basic.alerts-notify-off': '[copy: basic.alerts-notify-off]',
  'basic.alerts-allow': '[copy: basic.alerts-allow]', // ask for Notifications again (button)
  // Connected: the account's Wishlist counts too (read, never written or sent back).
  'basic.alerts-wishlist-on': '[copy: basic.alerts-wishlist-on]',
  // Not connected: only the hangar's rules; Connect adds the Wishlist.
  'basic.alerts-wishlist-connect': '[copy: basic.alerts-wishlist-connect]',
  // The last check didn't reach openhangar.space: it tries again later, calm.
  'basic.alerts-trouble': '[copy: basic.alerts-trouble]',
  // --- Updates ---
  'basic.update-ready': '[copy: basic.update-ready {version}]',
  'basic.update-reload': '[copy: basic.update-reload]',
};

export function t(key, vars = {}) {
  const s = COPY[key];
  if (s == null) throw new Error(`basic page copy: no "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
export const KEYS = Object.keys(COPY);
