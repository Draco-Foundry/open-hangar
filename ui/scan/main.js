// The hidden scan page (src/scan.html, the connector build): the scan runner (./runner.js)
// with no tab and nothing on screen. src/scan-host.js opens it, in an offscreen document
// on Chrome and Edge (`by: 'offscreen'`, where src/scan-shim.js stands in for
// chrome.storage and chrome.permissions) and in a hidden frame of Firefox's event page
// (`by: 'frame'`), with its run in the address. It runs the scan asked of that run
// (session scanRequest, the way the Open Hangar page takes one for its tab), then the
// pack reads, saves everything and says it's done; the worker closes it. Nothing here
// asks the browser for anything: what needs a click stays on the Open Hangar page.
// Auto Scan Daily's run (reason 'auto', the `autoScan` flag) runs here and only here.
import { createRunner } from './runner.js';
import { rsiCookie } from '../popup/rsi-cookie.js';

const OH = globalThis.OH;
// This build's flags (src/flags.js), as ui/lib/flags.js reads them (not imported: this
// page needs none of the Svelte pages' shared code).
const flag = (name) => OH?.flags?.[name] === true;
const RUN = /^[\w-]{6,64}$/;
const params = new URLSearchParams(location.search);
const by = params.get('by') === 'frame' ? 'frame' : 'offscreen';
const run = RUN.test(params.get('run') || '') ? params.get('run') : null;
// A scan request counts this long (src/background.js SCAN_ASK_GAP).
const ASK_MAX = 60e3;
// Firefox suspends its event page about 30 seconds after the last event, and a fetch or
// a storage write isn't one: a message is. So the frame says it's still here after
// every page it reads (at most every 2 seconds) and every 10 seconds while it works.
const PING_GAP = 10e3;
const PING_MIN = 2e3;
const RSI_HOST = { origins: ['https://robertsspaceindustries.com/*'] };
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
const firefox = () => !!chrome.runtime.getManifest?.()?.browser_specific_settings?.gecko;

const tell = (op, arg) =>
  chrome.runtime.sendMessage({ ohScan: arg ? { op, run, arg } : { op, run } });
let pingAt = 0;
function ping(force = false) {
  if (by !== 'frame') return;
  const t = Date.now();
  if (!force && t - pingAt < PING_MIN) return;
  pingAt = t;
  tell('ping').catch(() => {});
}

const runner = createRunner({
  OH,
  store: chrome.storage.local,
  session: chrome.storage.session || null,
  me: { by, tabId: null, run },
  // Access to RSI off: the scan is held ('no-rsi' in its report), and the popup or the
  // Open Hangar page asks on a click.
  mayReadRsi: async () =>
    !chrome.permissions?.contains || chrome.permissions.contains(RSI_HOST).catch(() => true),
  // Firefox's yes to share, given before (the Open Hangar page asks on a click).
  mayShare: async () => !firefox() || chrome.permissions.contains(SITE_DATA).catch(() => false),
  // Auto Scan Daily's sign-in check: whether RSI's sign-in cookie is here, nothing more
  // (the popup's check; on Chrome and Edge src/scan-shim.js asks the worker, which says
  // only whether it's there).
  rsiCookie: () => rsiCookie(chrome.cookies),
  hooks: { progress: () => ping() },
});

// The scan asked of this run, once its mark is stored (or it won't run), so the worker
// always sees one or the other. → whether there was one.
async function takeRequest() {
  const session = chrome.storage.session;
  const { scanRequest: r } = await session.get('scanRequest');
  if (!r || r.run !== run) return false;
  const go = Date.now() - r.at < ASK_MAX && !runner.busy;
  // Auto Scan Daily's run is never a Scan in its place (a build without it never asks).
  const running = !go
    ? null
    : r.reason === 'auto'
      ? flag('autoScan')
        ? runner.autoScan()
        : null
      : runner.scan({ reason: r.reason === 'site' ? 'site' : 'popup' });
  await runner.marked();
  // Only this request: one asked for since is the next one's.
  const { scanRequest: still } = await session.get('scanRequest');
  if (still?.run === run && still.at === r.at) await session.remove('scanRequest');
  await running;
  return true;
}

// Every scan asked of this page, one after the other, each to its end. Asked again
// while it runs, the answer is this one's.
let taking = null;
const takeAll = () =>
  (taking ??= (async () => {
    while (await takeRequest());
  })().finally(() => (taking = null)));

// Every scan asked of this page and the pack reads after them, everything saved, then
// done. A scan asked for while the packs are read starts at once (kick, below), as on
// the Open Hangar page, so it never waits on them and goes stale. Once the page is
// saying it's done (`closing`), one asked for is the worker's to hand back (`again`).
// Stopped on an error, it says so, and scans go to the tab (src/scan-host.js).
let closing = false;
async function work() {
  const beat = by === 'frame' ? setInterval(() => ping(true), PING_GAP) : null;
  // The kill switch's file (status.json), fresh for where the next scan runs: read
  // before anything here can fail (the scan reads it again from the cache).
  OH.getRemoteStatus?.()?.catch(() => {});
  try {
    for (let again = true; again;) {
      closing = false;
      do {
        await takeAll();
        await runner.packsDone();
      } while (taking);
      closing = true;
      await OH.flushBuybackDetails?.();
      await OH.storageSettled?.();
      const r = await tell('done').catch(() => null);
      again = !!r?.value?.again;
    }
  } catch (e) {
    closing = true;
    OH.log?.('warn', 'status', `hidden scan page: ${e?.message || e}`);
    await tell('done', { failed: true }).catch(() => null);
  } finally {
    clearInterval(beat);
  }
}
let working = null;
function kick() {
  if (working) {
    if (!closing) takeAll().catch(() => {});
    return working;
  }
  return (working = work().finally(() => {
    working = null;
    closing = false;
  }));
}

if (run && OH) {
  // A scan asked of this page while it's open: the worker tells it, and Firefox's frame
  // hears the request itself too.
  chrome.runtime.onMessage?.addListener((msg) => {
    if (msg?.ohScanPage?.op === 'go' && msg.ohScanPage.run === run) kick();
    return false;
  });
  chrome.storage.onChanged?.addListener((c, area) => {
    if (area === 'session' && c.scanRequest?.newValue?.run === run) kick();
  });
  kick();
} else if (run) tell('done').catch(() => {});
