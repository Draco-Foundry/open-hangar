// Every new word the basic page shows, in one place: the owner's approved words
// (2026-10-13), word for word. The note beside each says what it's for. Words the
// extension already uses elsewhere (Buy-Backs, Export CSV, Export JSON, Clear Data,
// Saved Accounts, Sync Now, Disconnect, Log Out of RSI, Report a Scan Problem, Connect
// to openhangar.space, the type names) are used as they are, not repeated here. {name}
// parts are filled in by t(), and a key's '.one' words stand in when {n} is 1 ("1
// pledge"). Headings and buttons in Title Case. Since 0.4.0 the page shows fewer of
// them (its lists, Your Data, Saved Accounts and the alerts card moved to the popup,
// whose words are in ../popup/copy.js); the words only the old page used are gone.
const COPY = {
  // --- Page ---
  'basic.loading': 'Loading your hangar.', // the moment before the stored hangar loads
  // NEW: needs the owner's OK. The page's one line when it isn't open for anything else:
  // the popup is where Open Hangar is now, and why this page opens at all.
  'basic.page-about':
    "Open Hangar lives in the toolbar popup now. This page only opens when it needs to ask you something, or when a scan can't run hidden.",
  // --- Scan ---
  'basic.scan': 'Scan', // the Scan button
  'basic.scanning': 'Scanning', // the button while a scan runs
  'basic.scan-start': 'Asking RSI for your hangar.', // first progress line, before RSI answers
  // Another Open Hangar tab is scanning, so this one's Scan waits (#658). The popup's
  // approved words for the same thing (popup.scan-busy), word for word.
  'basic.scan-elsewhere': 'A scan is already running.',
  // Access to robertsspaceindustries.com is off (Firefox's add-ons page, say): the short
  // reason above the "Allow Access to RSI" button. Scan reads your hangar there, and
  // only there; one click lets it, then the scan runs.
  'basic.rsi-access-why':
    'Scan reads your hangar on robertsspaceindustries.com, and only there. Allow it once and the scan starts.',
  // Progress: part is Hangar or Buy-Backs; page and count so far.
  'basic.progress': '{part}: page {page}, {count} so far',
  'basic.progress-retry': '{part}: page {page}. RSI stalled, trying again ({n} of {of})', // RSI hiccup
  'basic.progress-referrals': 'Referrals: {n} so far',
  'basic.row-pledges': '{n} pledges', // report row: pledges read
  'basic.row-pledges.one': '{n} pledge',
  'basic.row-buybacks': '{n} buy-backs', // report row: buy-backs read
  'basic.row-buybacks.one': '{n} buy-back',
  'basic.row-referrals': 'referrals read', // report row: referrals read
  // The same row in the problem box, which shows each row as "{name}: {text}":
  // "Referrals: read".
  'basic.row-referrals-box': 'read',
  'basic.scan-done': 'Scan complete:', // before the rows of a scan that went fine
  'basic.scan-problem': 'The Scan Ran Into Trouble', // title of a scan with a problem
  // Signed out of RSI: the problem box's title, and the line under it (nothing was
  // scanned, your saved hangar is safe, log in on RSI).
  'basic.signed-out': "You're Signed Out of RSI",
  'basic.signed-out-line':
    'Nothing was scanned, and your saved hangar is safe. Log in on RSI, then scan again.',
  // RSI didn't answer a scan: a 5xx, and a 429 (RSI asked us to wait; {time} is when to
  // scan again). In the problem box (Claude chat, Words, 2026-10-22).
  'basic.rsi-down':
    "RSI isn't answering, so the scan stopped. The parts it didn't finish keep your last scan. Try again soon.",
  'basic.rsi-wait':
    "RSI asked us to wait, so the scan stopped. The parts it didn't finish keep your last scan. Scan again after {time}.",
  // A different RSI account is signed in: its hangar is loaded (back) or needs a scan.
  'basic.switched-back': "Signed in as {who} on RSI: that account's saved hangar is back.",
  'basic.switched-new': 'Signed in as {who} on RSI: that account has no scan here yet. Press Scan.',
  // --- Lists ---
  // --- Settings ---
  'basic.connect-about': 'Optional. Connect to see your hangar on any device.', // optional; see it on any device
  'basic.connected': 'Connected as {name}',
  'basic.synced': 'Synced {when}',
  'basic.not-synced': 'Not synced yet',
  // The website took a sync for this account moments ago (too soon): calm, never an
  // error code; Sync Now works again at {time} ("6:02 PM"). The owner's words start
  // "try again at ..." (#570). The website's own sentence shows under it.
  'basic.sync-wait': 'Try again at {time}. The last sync was moments ago.',
  'basic.syncing': 'Syncing now',
  'basic.connect-failed': "Connecting didn't finish. Try again.", // the token trade failed: try again
  // Connect with a code, where there's no sign-in window (Firefox for Android): the
  // dashboard's words, word for word (ui/site/SiteConnect.svelte, src/dashboard.js).
  'basic.code-hint': 'Approve this code on openhangar.space',
  'basic.code-again': 'Open the Page Again',
  'basic.code-cancel': 'Cancel',
  'basic.code-expired': 'That code expired before it was approved. Connect again.',
  // --- Firefox's data ask (its card's words: ui/basic/FirefoxCard.svelte) ---
  'basic.firefox-no': 'Firefox said no, so sync stays off.', // Firefox said no: sync stays off
  // --- A new RSI account on a connected browser ---
  'basic.pilot-title': 'Sync {handle} Too?',
  'basic.pilot-body':
    "It hasn't synced to your openhangar.space account before. Syncing adds its hangar there too.",
  'basic.pilot-yes': 'Sync It',
  'basic.pilot-no': 'Not This One',
  // --- Connect came back with another openhangar.space account (connect hardening) ---
  // Asked on this page before anything is replaced or synced: {from} is the account
  // this browser is connected to now, {to} the one the sign-in window approved.
  'basic.switch-title': 'Switch to {to}?',
  'basic.switch-body':
    'This browser is connected to {from}. Switching sends your hangar to {to} from now on.',
  'basic.switch-yes': 'Switch to {to}',
  'basic.switch-no': 'Stay with {from}',
  // --- Store alerts (the `alerts` flag; the popup's switch since 0.4.0) ---
  // --- Words that sat in the template, moved here word for word ---
  'basic.allow-rsi': 'Allow Access to RSI',
  'basic.report-problem': 'Report a Scan Problem',
  // --- Updates ---
  'basic.update-ready': 'Open Hangar {version} is ready.',
  'basic.update-reload': 'Reload to Update',
};

export function t(key, vars = {}) {
  const s = (vars.n === 1 && COPY[`${key}.one`]) || COPY[key];
  if (s == null) throw new Error(`basic page copy: no "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
export const KEYS = Object.keys(COPY);
