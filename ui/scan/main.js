// The hidden scan page (src/scan.html, the connector build): the scan runner (./runner.js)
// with no tab and nothing on screen. src/scan-host.js opens it, in an offscreen document
// on Chrome and Edge (`by: 'offscreen'`, where src/scan-shim.js stands in for
// chrome.storage and chrome.permissions) and in a hidden frame of Firefox's event page
// (`by: 'frame'`), with its run in the address. It runs the scan asked of that run
// (session scanRequest, the way the Open Hangar page takes one for its tab), then the
// pack reads, saves everything and says it's done; the worker closes it. Nothing here
// asks the browser for anything: what needs a click stays on the Open Hangar page.
import { createRunner } from './runner.js';

const OH = globalThis.OH;
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

const tell = (op) => chrome.runtime.sendMessage({ ohScan: { op, run } });
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
  hooks: { progress: () => ping() },
});

// The scan asked of this run, once its mark is stored (or it won't run), so the worker
// always sees one or the other. → whether there was one.
async function takeRequest() {
  const session = chrome.storage.session;
  const { scanRequest: r } = await session.get('scanRequest');
  if (!r || r.run !== run) return false;
  const go = Date.now() - r.at < ASK_MAX && !runner.busy;
  const running = go ? runner.scan({ reason: r.reason === 'site' ? 'site' : 'popup' }) : null;
  await runner.marked();
  // Only this request: one asked for since is the next one's.
  const { scanRequest: still } = await session.get('scanRequest');
  if (still?.run === run && still.at === r.at) await session.remove('scanRequest');
  await running;
  return true;
}

// Every scan asked of this page, then its pack reads, everything saved, then done. The
// worker answers `again` when a scan was asked of it meanwhile.
async function work() {
  const beat = by === 'frame' ? setInterval(() => ping(true), PING_GAP) : null;
  try {
    for (let again = true; again;) {
      while (await takeRequest());
      await runner.packsDone();
      await OH.flushBuybackDetails?.();
      await OH.storageSettled?.();
      const r = await tell('done').catch(() => null);
      again = !!r?.value?.again;
    }
  } catch (e) {
    OH.log?.('warn', 'status', `hidden scan page: ${e?.message || e}`);
    await tell('done').catch(() => null);
  } finally {
    clearInterval(beat);
  }
}
let working = null;
const kick = () => (working ??= work().finally(() => (working = null)));

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
