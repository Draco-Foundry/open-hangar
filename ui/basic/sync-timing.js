// When the Open Hangar page may sync to openhangar.space (#658). Never while a scan
// runs, in this tab or another Open Hangar tab: a sync then would send half a hangar,
// and the website's pace (one sync per RSI account every few minutes) would refuse the
// finished one. A sync asked for meanwhile waits for the scan's own sync at its end.
// Pure (test/basic-sync.test.js); ui/basic/hub.svelte.js keeps the state.

// A scan mark older than this is a page that went away mid-scan: the same 10 minutes
// as src/background.js and the popup (ui/popup/data.js). A running scan renews its
// mark every minute (hub.svelte.js scanMark).
export const SCAN_RUN_MAX = 10 * 60e3;

// Another tab's scan, from its scanRunning mark ({ at, tabId }). A mark without a tab
// (a browser that can't say) counts, unless this tab's own scan is the one running.
export function scanElsewhere(mark, tabId, now = Date.now()) {
  if (!Number.isFinite(mark?.at) || now - mark.at >= SCAN_RUN_MAX) return false;
  return mark.tabId == null || tabId == null || mark.tabId !== tabId;
}

// → 'now', or 'after-scan' (the sync is kept and sent when the scan is done).
// busyHere: this tab is scanning; elsewhere: another tab is (scanElsewhere);
// scanDone: this is the scan's own sync, just after it finished.
export function syncWhen({ busyHere = false, elsewhere = false, scanDone = false } = {}) {
  if (elsewhere) return 'after-scan';
  if (busyHere && !scanDone) return 'after-scan';
  return 'now';
}

// The sync after a scan: whether to send, and as what. A sync asked for during the
// scan (`kept`: { at, auto }) is sent even when the scan itself didn't save anything
// (signed out: the hangar already stored is the one asked for), and keeps its own
// `auto` (Sync Now and Connect's first sync aren't held by the not-open wait).
export function afterScan({ linked, signedOut, kept }) {
  if (!linked) return null;
  if (!kept && signedOut) return null;
  return { auto: kept ? kept.auto !== false : true };
}

// A sync the website's pace held back (`again`: { at }) goes once more when no wait
// holds it any longer (`wait`: OH.siteSyncWait's answer).
export const retryDue = (again, wait) => Number.isFinite(again?.at) && !wait;
