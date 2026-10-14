/*
 * scan-host.js: where a scan runs, for the background worker (src/background.js), in
 * the connector build (scripts/scan-host.mjs). Exposed as self.OHScanHost.
 * ---------------------------------------------------------------------------
 * A scan reads RSI's pages as HTML, and only a page has DOMParser: the background
 * itself never scans. Until 0.4.0 the page was the Open Hangar page in a tab. Now it's
 * a hidden page, src/scan.html (ui/scan/main.js), so no tab opens:
 *
 *   'offscreen'  Chrome and Edge: an offscreen document (the `offscreen` permission).
 *                It only has chrome.runtime, so src/scan-shim.js gives it
 *                chrome.storage and chrome.permissions.contains through messages this
 *                worker answers (below), and only for that page.
 *   'frame'      Firefox: a hidden frame in its event page, which has every API.
 *                Firefox suspends the event page about 30 seconds after its last
 *                event (a fetch or a storage write isn't one), so the frame pings
 *                after every page and every 10 seconds while it works.
 *   'tab'        Neither (or the kill switch, below, access to RSI turned off, which
 *                that page asks for on a click, or the hidden page couldn't be made):
 *                the Open Hangar page in a tab, as before.
 *
 * The page's run (ui/scan/runner.js) is in its address (?run=…&by=…&v=…, v: this
 * version, which an offscreen document can't read itself). A scan asked for leaves
 * session `scanRequest { at, tabId: null, reason, run, by }` for that run, the way a
 * tab's names its tab; the page takes it, scans, reads the packs, saves, and says
 * `done`; then it's closed, and any mark it left goes with it.
 *
 * The kill switch: site/status.json `"sources": { "scanHidden": { "enabled": false } }`
 * (as the extension's pages cached it, `remoteStatus`) sends scans back to the tab. It
 * can only turn the hidden page off, never anything on.
 *
 * Messages from the page, one type, each checked: { ohScan: { op, run?, arg? } } →
 * { ok: true, value } | { ok: false, error }, answered only for src/scan.html in this
 * extension, never a tab (an extension page at exactly that address, with no tab):
 *   ping                    the frame is still working (Firefox)
 *   done                    its work is done → { again: true } when a scan was asked
 *                           of it meanwhile, else {} (and it's closed)
 *   local.get | local.set | local.remove | local.getKeys | local.getBytesInUse
 *   session.get | session.set | session.remove
 *   permissions.contains    the offscreen page's storage and permission checks
 */
(function (root) {
  const PAGE = 'src/scan.html';
  const FRAME_ID = 'oh-scan';
  // src/background.js: a scan mark older than this is a page that went away; a scan
  // request is pending this long.
  const SCAN_RUN_MAX = 10 * 60e3;
  const ASK_MAX = 60e3;
  // The offscreen document's reason, for Chrome's review (docs/STORE.md, offscreen).
  const WHY =
    "Scans read the user's own RSI pages as HTML. The offscreen document parses them with DOMParser, so the scan runs without opening a tab.";
  const RUN = /^[\w-]{6,64}$/;
  const RSI_HOST = { origins: ['https://robertsspaceindustries.com/*'] };
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const strings = (x) => Array.isArray(x) && x.every((s) => typeof s === 'string');
  const keysArg = (k) => k === null || typeof k === 'string' || strings(k);

  // The kill switch, as cached: true when status.json turns the hidden page off.
  function switchedOff(status) {
    const s = isObj(status) && isObj(status.data) && status.data.sources;
    return isObj(s) && isObj(s.scanHidden) && s.scanHidden.enabled === false;
  }

  // Each op's argument check.
  const OPS = {
    ping: () => true,
    done: () => true,
    'local.get': (a) => keysArg(a) || isObj(a),
    'session.get': (a) => keysArg(a) || isObj(a),
    'local.set': isObj,
    'session.set': isObj,
    'local.remove': (a) => typeof a === 'string' || strings(a),
    'session.remove': (a) => typeof a === 'string' || strings(a),
    'local.getKeys': () => true,
    'local.getBytesInUse': keysArg,
    'permissions.contains': (a) =>
      isObj(a) &&
      Object.keys(a).every((k) => ['origins', 'permissions', 'data_collection'].includes(k)) &&
      Object.values(a).every(strings),
  };
  // A message from the page, checked → { op, run, arg }, or null.
  function vet(m) {
    if (!isObj(m) || typeof m.op !== 'string' || !Object.hasOwn(OPS, m.op)) return null;
    const arg = m.arg === undefined ? null : m.arg;
    if (!OPS[m.op](arg)) return null;
    const run = typeof m.run === 'string' && RUN.test(m.run) ? m.run : null;
    if (m.op === 'done' && !run) return null;
    return { op: m.op, run, arg };
  }

  // env: { chrome, document (Firefox's event page; null in a service worker), now,
  // afterDone (a page closed: src/background.js lets a waiting update in) }.
  function create(env) {
    const chrome = env.chrome;
    const doc = env.document || null;
    const now = env.now || (() => Date.now());
    const pageUrl = () => chrome.runtime.getURL(PAGE);
    const isPage = (url) => String(url || '').split(/[?#]/)[0] === pageUrl();
    const runOf = (url) => {
      try {
        const run = new URL(url).searchParams.get('run');
        return run && RUN.test(run) ? run : null;
      } catch {
        return null;
      }
    };
    const version = () => {
      try {
        return chrome.runtime.getManifest().version || '';
      } catch {
        return '';
      }
    };

    // What this browser can run a hidden page in.
    function kind() {
      if (chrome.offscreen?.createDocument && chrome.runtime.getContexts) return 'offscreen';
      if (doc?.createElement && (doc.body || doc.documentElement)) return 'frame';
      return 'tab';
    }
    // Where the next scan runs: the hidden page, unless this browser has none, the kill
    // switch sends it to the tab, or access to RSI is off (then the tab's page asks for
    // it on a click, Allow Access to RSI, and scans: a hidden scan could only be held).
    async function choose() {
      const k = kind();
      if (k === 'tab') return k;
      try {
        const { remoteStatus } = await chrome.storage.local.get('remoteStatus');
        if (switchedOff(remoteStatus)) return 'tab';
        const rsi = await chrome.permissions.contains(RSI_HOST).catch(() => true);
        return rsi === false ? 'tab' : k;
      } catch {
        return 'tab';
      }
    }

    // The hidden page open now → { by, run }, or null. Throws when the browser can't
    // say.
    async function open() {
      const k = kind();
      if (k === 'offscreen') {
        const docs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
        const mine = (docs || []).find((c) => isPage(c.documentUrl));
        return mine ? { by: k, run: runOf(mine.documentUrl) } : null;
      }
      if (k === 'frame') {
        const f = doc.getElementById(FRAME_ID);
        return f ? { by: k, run: runOf(f.src) } : null;
      }
      return null;
    }

    // Chrome allows one offscreen document: never two at once.
    let creating = null;
    async function make(by, run) {
      const url = `${PAGE}?${new URLSearchParams({ run, by, v: version() })}`;
      if (by === 'offscreen') {
        creating ??= chrome.offscreen
          .createDocument({ url, reasons: ['DOM_PARSER'], justification: WHY })
          .finally(() => (creating = null));
        return creating;
      }
      const f = doc.createElement('iframe');
      f.id = FRAME_ID;
      f.hidden = true;
      f.setAttribute('aria-hidden', 'true');
      f.src = chrome.runtime.getURL(url);
      (doc.body || doc.documentElement).appendChild(f);
    }
    // Closes the hidden page (only the one for `run`, when given). → whether it did.
    async function close(run) {
      const k = kind();
      if (k === 'offscreen') {
        const was = await open().catch(() => null);
        if (!was || (run && was.run !== run)) return false;
        await chrome.offscreen.closeDocument().catch(() => {});
        return true;
      }
      if (k === 'frame') {
        const f = doc.getElementById(FRAME_ID);
        if (!f || (run && runOf(f.src) !== run)) return false;
        f.remove();
        return true;
      }
      return false;
    }
    // The page went quiet: its scan mark is older than a running scan's ever gets, or a
    // scan asked of it a minute ago was never taken.
    async function stuck(run) {
      const s = await chrome.storage.session.get(['scanRunning', 'scanRequest']);
      const old = (x, max) => x?.run === run && Number.isFinite(x.at) && now() - x.at >= max;
      return old(s.scanRunning, SCAN_RUN_MAX) || old(s.scanRequest, ASK_MAX);
    }
    // A scan asked of a page already open (it's reading packs, say): told at once.
    // Firefox's frame also hears the request itself (storage.onChanged).
    function poke(run) {
      try {
        chrome.runtime.sendMessage({ ohScanPage: { op: 'go', run } })?.catch?.(() => {});
      } catch {
        /* no page listening */
      }
    }

    // start, done and close one at a time, so a scan asked for while the last one says
    // it's done is never lost between them.
    let line = Promise.resolve();
    function inLine(fn) {
      const next = line.then(fn);
      line = next.catch(() => {});
      return next;
    }

    // A scan asked for (requestScan): its request, for the hidden page open now or a
    // new one. → { by, run }, or null when it runs in the tab instead (no hidden page
    // here, the kill switch, or the page couldn't be made).
    const start = (reason) =>
      inLine(async () => {
        const by = await choose();
        if (by === 'tab') return null;
        let run = null;
        try {
          let host = await open();
          if (host && (!host.run || (await stuck(host.run)))) {
            await close();
            host = null;
          }
          run = host?.run || newRun();
          await chrome.storage.session.set({
            scanRequest: { at: now(), tabId: null, reason, run, by },
          });
          if (host) poke(run);
          else await make(by, run);
          return { by, run };
        } catch (e) {
          console.warn('[OpenHangar] the hidden scan page:', e?.message || e);
          if (run) await dropRequest(run).catch(() => {});
          return null;
        }
      });
    async function dropRequest(run) {
      const { scanRequest: r } = await chrome.storage.session.get('scanRequest');
      if (r?.run === run) await chrome.storage.session.remove('scanRequest');
    }

    // The page's work is done: closed, unless a scan was asked of it meanwhile. Its
    // marks go with it (a closed page can't take them itself).
    const done = (run) =>
      inLine(async () => {
        const s = await chrome.storage.session.get(['scanRequest', 'scanRunning', 'scanProgress']);
        const r = s.scanRequest;
        if (r?.run === run && Number.isFinite(r.at) && now() - r.at < ASK_MAX) {
          poke(run);
          return { again: true };
        }
        const left = ['scanRequest', 'scanRunning', 'scanProgress'].filter(
          (k) => s[k]?.run === run,
        );
        if (left.length) await chrome.storage.session.remove(left);
        await close(run);
        await env.afterDone?.();
        return {};
      });

    // A scan mark from a hidden page ({ by, run }) is that page's while it's open. A
    // browser that can't see hidden pages (or can't say right now) trusts the mark for
    // its 10 minutes.
    async function alive(mark) {
      if (kind() === 'tab') return true;
      try {
        const h = await open();
        return !!h && (!mark?.run || h.run === mark.run);
      } catch {
        return true;
      }
    }
    // A hidden page is open (scanning, or reading packs after): an update waits for it.
    async function busy() {
      try {
        return !!(await open());
      } catch {
        return true;
      }
    }

    // What the page asks of the worker (see the top).
    async function answer({ op, run, arg }) {
      if (op === 'ping') return {};
      if (op === 'done') return done(run);
      if (op === 'permissions.contains') return chrome.permissions.contains(arg);
      const [name, fn] = op.split('.');
      const area = chrome.storage[name];
      if (fn === 'getKeys')
        return typeof area.getKeys === 'function'
          ? area.getKeys()
          : Object.keys((await area.get(null)) || {});
      if (fn === 'getBytesInUse') {
        if (typeof area.getBytesInUse !== 'function') throw new Error('no getBytesInUse here');
        return area.getBytesInUse(arg);
      }
      const out = await area[fn](arg);
      return fn === 'get' ? out : null;
    }
    // Only the hidden page: this extension, exactly its address (any ?run=…), no tab.
    const fromPage = (sender) =>
      !!sender && sender.id === chrome.runtime.id && !sender.tab && isPage(sender.url);
    // runtime.onMessage's listener for { ohScan }.
    function heard(msg, sender, reply) {
      if (!isObj(msg) || !('ohScan' in msg)) return false;
      if (!fromPage(sender)) return false;
      const m = vet(msg.ohScan);
      if (!m) {
        reply({ ok: false, error: 'not a request this page may make' });
        return false;
      }
      Promise.resolve()
        .then(() => answer(m))
        .then(
          (value) => reply({ ok: true, value: value === undefined ? null : value }),
          (e) => reply({ ok: false, error: String(e?.message || e) }),
        );
      return true; // answers later
    }

    return { kind, choose, open, start, done, close, alive, busy, heard, fromPage };
  }

  // A run id, as ui/scan/runner.js makes one.
  function newRun() {
    const bytes = root.crypto?.getRandomValues?.(new Uint8Array(6));
    const tail = bytes
      ? [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    return `${Date.now().toString(36)}-${tail}`;
  }

  root.OHScanHost = Object.freeze({ PAGE, FRAME_ID, WHY, create, vet, switchedOff, newRun });
})(typeof self !== 'undefined' ? self : globalThis);
