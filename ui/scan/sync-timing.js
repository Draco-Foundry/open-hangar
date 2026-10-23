// When a scan's page may sync to openhangar.space (#658). Never while a scan runs, in
// this page or another Open Hangar page: a sync then would send half a hangar, and the
// website's pace (one sync per RSI account every few minutes) would refuse the finished
// one. A sync asked for meanwhile waits for the scan's own sync at its end.
// Pure (test/basic-sync.test.js); ui/scan/runner.js keeps the state.

// A scan mark older than this is a scan that stopped (its page went away mid-scan, or
// it hung): the same 2 minutes as src/background.js and the popup (ui/popup/data.js).
// The mark is the scan's heartbeat: renewed every 30 seconds while it reads
// (ui/scan/runner.js MARK_GAP).
export const SCAN_RUN_MAX = 2 * 60e3;

// Another page's scan, from its scanRunning mark ({ at, tabId, run, by }). `me` is the
// asking page: { tabId, run }, or just its tab id. A mark with a run id belongs to that
// run: this page's own run is never another page's scan, whatever its tab (a hidden
// page has none), and neither is a page this tab showed before. A mark without a run
// id (an older page) is keyed on its tab: one without a tab, or a page that can't say
// which tab it is, counts as another.
export function scanElsewhere(mark, me, now = Date.now()) {
  if (!Number.isFinite(mark?.at) || now - mark.at >= SCAN_RUN_MAX) return false;
  const { tabId = null, run = null } = me && typeof me === 'object' ? me : { tabId: me };
  const sameTab = mark.tabId != null && tabId != null && mark.tabId === tabId;
  if (mark.run != null && run != null) return mark.run !== run && !sameTab;
  return !sameTab;
}

// → 'now', or 'after-scan' (the sync is kept and sent when the scan is done).
// busyHere: this page is scanning; elsewhere: another page is (scanElsewhere);
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
