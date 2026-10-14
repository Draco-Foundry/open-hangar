'use strict';
// The background worker (src/background.js) as scripts/pack.mjs builds it, in a
// sandbox with a stand-in browser: its flags written into flags.js, its pages into
// site-pages.js (bridge v2), the code of every flag that's off cut, and a fake
// chrome API (storage, tabs, the two message listeners, offscreen documents, an event
// page's document for Firefox's frames). Used by the bridge tests (test/bridge-v2.test.js,
// test/site-connect.test.js, test/rsi-cart.test.js) and the hidden scan page's
// (test/scan-host.test.js).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

// The flag registry (src/flags.js). STORE_FLAGS: every store build's set, its defaults
// (the connector with Local Mode and sync since 0.3.0).
const REGISTRY = (() => {
  const root = {};
  vm.runInNewContext(read('flags.js'), { self: root });
  return root.OH.flagRegistry;
})();
const STORE_FLAGS = Object.freeze(
  Object.fromEntries(Object.entries(REGISTRY).map(([k, f]) => [k, f.default === true])),
);
// A build's whole set, as scripts/pack.mjs writes it: a flag a test leaves out is off,
// in flags.js and in the code cut alike.
const wholeFlags = (flags) =>
  Object.fromEntries(Object.keys(REGISTRY).map((k) => [k, flags[k] === true]));

const FRONT = 'https://openhangar.space';
const APP = 'https://app.openhangar.space';
const HANGAR = 'https://hangar.openhangar.space';
const STAGING = 'https://staging.openhangar.space';
const HANGAR_STAGING = 'https://hangar-staging.openhangar.space';
const CHROME_ID = 'abcdefghijklmnopabcdefghijklmnop';
const FIREFOX_ID = 'open-hangar@draco-foundry';

// The pages a build lets in, as scripts/site-pages.mjs pagesFor decides them.
function pagesFor({ localMode, sync, staging = false }) {
  const hangar = localMode ? [HANGAR, ...(staging ? [HANGAR_STAGING] : [])] : [];
  const site = [FRONT, APP, ...(staging ? [STAGING] : [])];
  return { hangar, site, connect: sync ? site.filter((o) => o !== FRONT) : [] };
}

// A source file's text with the blocks of flags that are off cut (@flag-start name /
// @flag-end name, and @sync-start / @sync-end for `sync`), as scripts/pack.mjs does.
function cutFlags(text, flags) {
  const out = [];
  let open = null;
  for (const line of text.split('\n')) {
    const m = /@(?:(sync)-(start|end)|flag-(start|end)\b[ \t]*([A-Za-z0-9_]*))/.exec(line);
    if (!m) {
      if (!open || flags[open]) out.push(line);
      continue;
    }
    const name = m[1] || m[4];
    if ((m[2] || m[3]) === 'start') open = name;
    if (flags[name]) out.push(line);
    if ((m[2] || m[3]) === 'end') open = null;
  }
  return out.join('\n');
}
function replaceOnce(text, line, value) {
  if (text.split(line).length !== 2) throw new Error(`expected one "${line}"`);
  return text.replace(line, value);
}
// The built copies of the files pack.mjs writes into.
const builtPages = (pages) =>
  replaceOnce(
    read('site-pages.js'),
    'const BUILD_PAGES = { hangar: [], site: [], connect: [] };',
    `const BUILD_PAGES = ${JSON.stringify(pages)};`,
  );
const builtFlags = (flags) =>
  replaceOnce(
    read('flags.js'),
    'const BUILD_VALUES = {};',
    `const BUILD_VALUES = ${JSON.stringify(flags)};`,
  );
const builtBridge = (pages) =>
  replaceOnce(
    read('site-bridge.js'),
    'const PAGES = [];',
    `const PAGES = ${JSON.stringify([...pages.hangar, ...pages.site])};`,
  );

// chrome.storage's areas: copies in and out, as the real one. `changed` (optional): the
// onChanged listeners to tell, as the browser does after a write.
function area(data, changed = null, name = 'local') {
  const tell = (before) => {
    if (!changed) return;
    const c = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(data)]))
      if (JSON.stringify(before[k]) !== JSON.stringify(data[k]))
        c[k] = { oldValue: before[k], newValue: structuredClone(data[k]) };
    if (Object.keys(c).length) for (const f of changed) f(c, name);
  };
  const pick = (k) =>
    k == null
      ? Object.keys(data)
      : typeof k === 'string'
        ? [k]
        : Array.isArray(k)
          ? k
          : Object.keys(k);
  return {
    get: async (k) =>
      Object.fromEntries(
        pick(k)
          .filter((x) => x in data)
          .map((x) => [x, structuredClone(data[x])]),
      ),
    set: async (o) => {
      const before = structuredClone(data);
      Object.assign(data, structuredClone(o));
      tell(before);
    },
    remove: async (k) => {
      const before = structuredClone(data);
      [].concat(k).forEach((x) => delete data[x]);
      tell(before);
    },
  };
}

// browser: 'chrome' (Chrome and Edge, with the identity API), 'firefox' (desktop),
// 'firefox-android' (Firefox's manifest, no identity API) or 'bare' (neither).
// flags: the build's flags (default: the store build's, STORE_FLAGS; one left out is
// off); pages: its page lists (default: the store's for those flags, with staging's for
// staging: true). local and session: what storage holds.
// granted: Firefox's data permission. contexts: runtime.getContexts' answer (null:
// a browser without it). fetch: the network (RSI's stand-in for Add to RSI Cart).
// Extension Alerts: notify (true: Notifications allowed, so chrome.notifications is
// there), and changes (true: storage writes tell the onChanged listeners, as the browser
// does). The fake alarms and notifications are in the answer.
// The hidden scan page (src/scan-host.js): offscreen (true: Chrome's chrome.offscreen,
// one document at a time, and getContexts with it; `failOffscreen`: creating one
// throws), frames (true: Firefox's event page has a document to hold a frame), rsi
// (false: access to robertsspaceindustries.com is turned off).
// getContexts answers only the context types asked for (a context with none is a TAB).
// The answer has `docs` (the offscreen documents open), `frames` (the document's
// frames), `sent` (runtime.sendMessage's messages), `reloaded` (runtime.reload calls),
// `updateAvailable(details)` and `fromScanPage(msg, query)`.
function loadBackground({
  browser = 'chrome',
  flags: given = STORE_FLAGS,
  staging = false,
  pages = pagesFor({ ...given, staging }),
  local = {},
  session = {},
  granted = true,
  contexts = null,
  fetch = async () => {
    throw new Error('no network here');
  },
  notify = false,
  changes = false,
  offscreen = false,
  failOffscreen = false,
  frames = false,
  rsi = true,
  globals = {},
} = {}) {
  const flags = wholeFlags(given);
  const firefox = browser === 'firefox' || browser === 'firefox-android';
  const listen = () => ({ addListener() {} });
  let external = null;
  // Every onMessage listener, in order (the connector build adds the popup's).
  const internal = [];
  const opened = [];
  const focused = [];
  let nextTab = 100;
  const changed = [];
  const alarms = new Map();
  const onAlarm = [];
  const notes = [];
  const onNoteClick = [];
  const docs = [];
  const sent = [];
  const onUpdate = [];
  const reloaded = [];
  if (offscreen && !contexts) contexts = [];
  const chrome = {
    storage: {
      local: area(local, changes ? changed : null, 'local'),
      session: area(session, changes ? changed : null, 'session'),
      onChanged: { addListener: (f) => void changed.push(f) },
    },
    alarms: {
      create: async (name, o) => void alarms.set(name, { name, ...o }),
      get: async (name) => (alarms.has(name) ? structuredClone(alarms.get(name)) : undefined),
      clear: async (name) => alarms.delete(name),
      onAlarm: { addListener: (f) => void onAlarm.push(f) },
    },
    ...(offscreen
      ? {
          offscreen: {
            createDocument: async (o) => {
              if (failOffscreen) throw new Error('offscreen documents are off here');
              if (docs.length) throw new Error('Only a single offscreen document may be created.');
              docs.push(structuredClone(o));
            },
            closeDocument: async () => {
              if (!docs.length) throw new Error('No current offscreen document.');
              docs.length = 0;
            },
          },
        }
      : {}),
    ...(notify
      ? {
          notifications: {
            create: async (id, o) => void notes.push({ id, ...o }),
            clear: async () => true,
            onClicked: { addListener: (f) => void onNoteClick.push(f) },
          },
        }
      : {}),
    ...(browser === 'chrome' || browser === 'firefox'
      ? {
          identity: {
            getRedirectURL: () =>
              firefox
                ? 'https://abc123.extensions.allizom.org/'
                : `https://${CHROME_ID}.chromiumapp.org/`,
          },
        }
      : {}),
    // Firefox's data permission (granted), or Notifications (notify).
    permissions: {
      contains: async (q) =>
        q && Array.isArray(q.permissions) && q.permissions.includes('notifications')
          ? notify
          : q && Array.isArray(q.origins)
            ? rsi
            : granted,
      onAdded: listen(),
    },
    runtime: {
      id: firefox ? FIREFOX_ID : CHROME_ID,
      onInstalled: listen(),
      onStartup: listen(),
      onUpdateAvailable: { addListener: (f) => void onUpdate.push(f) },
      reload: () => void reloaded.push(Date.now()),
      sendMessage: async (msg) => void sent.push(structuredClone(msg)),
      // Chrome and Firefox both have both; Firefox's pages never reach the first.
      onMessageExternal: { addListener: (f) => (external = f) },
      onMessage: { addListener: (f) => void internal.push(f) },
      getManifest: () => ({
        version: '0.3.0',
        ...(firefox
          ? {
              browser_specific_settings: { gecko: { id: FIREFOX_ID } },
              content_scripts: [
                {
                  matches: [...pages.hangar, ...pages.site].map((o) => `${o}/*`),
                  js: ['src/site-bridge.js'],
                },
              ],
            }
          : {
              externally_connectable: {
                matches: [...pages.hangar, ...pages.site].map((o) => `${o}/*`),
              },
            }),
      }),
      getURL: (p) => `${firefox ? 'moz-extension://uuid' : `chrome-extension://${CHROME_ID}`}/${p}`,
      ...(contexts
        ? {
            getContexts: async (q) => {
              const all = [
                ...contexts,
                ...docs.map((d) => ({
                  contextType: 'OFFSCREEN_DOCUMENT',
                  tabId: -1,
                  windowId: -1,
                  documentUrl: chrome.runtime.getURL(d.url),
                })),
              ];
              const types = q?.contextTypes;
              return structuredClone(
                types ? all.filter((c) => types.includes(c.contextType || 'TAB')) : all,
              );
            },
          }
        : {}),
    },
    action: { onClicked: listen(), setBadgeText() {}, setTitle() {}, setBadgeBackgroundColor() {} },
    tabs: {
      create: async (o) => {
        opened.push(o.url);
        return { id: nextTab++, url: o.url };
      },
      update: async (id, o) => {
        focused.push({ tab: id, ...o });
        return { id };
      },
    },
    windows: { update: async (id, o) => void focused.push({ window: id, ...o }) },
  };
  const files = {
    'flags.js': () => builtFlags(flags),
    'site-pages.js': () => builtPages(pages),
  };
  // Firefox's event page: a document whose body holds the hidden scan page's frame.
  const frameList = [];
  const document = frames
    ? {
        body: {
          appendChild: (el) => {
            el.parent = frameList;
            frameList.push(el);
            return el;
          },
        },
        documentElement: {},
        createElement: (tag) => ({
          tag,
          attrs: {},
          setAttribute(k, v) {
            this.attrs[k] = String(v);
          },
          remove() {
            const i = frameList.indexOf(this);
            if (i >= 0) frameList.splice(i, 1);
          },
        }),
        getElementById: (id) => frameList.find((el) => el.id === id) || null,
      }
    : undefined;
  const ctx = {
    chrome,
    console,
    crypto,
    TextEncoder,
    btoa,
    URL,
    URLSearchParams,
    setTimeout,
    AbortSignal,
    fetch,
    ...(document ? { document } : {}),
    ...globals,
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  ctx.importScripts = (...names) => {
    for (const f of names)
      vm.runInContext(files[f] ? files[f]() : read(f), ctx, { filename: `src/${f}` });
  };
  vm.runInContext(cutFlags(read('background.js'), flags), ctx, { filename: 'src/background.js' });

  // Answers come back copied out of the sandbox, so deepEqual compares plain values;
  // undefined = no answer at all (every listener let the message go). Like the
  // browser, each listener sees the message until one says it answers later.
  const answer = (listeners, msg, sender) =>
    new Promise((res) => {
      for (const listener of [].concat(listeners || [])) {
        const later = listener(msg, sender, (r) =>
          res(r === undefined ? r : JSON.parse(JSON.stringify(r))),
        );
        if (later) return;
      }
      res(undefined);
    });
  // Chrome and Edge: a page's message, with the origin the browser gives.
  const send = (msg, origin, sender = {}) => answer(external, msg, { origin, ...sender });
  // Firefox: the raw message as the bridge sends it, and its sender.
  const sendInternal = (msg, sender) => answer(internal, msg, sender);
  // Firefox: what the bridge passes on from a page at `url` (our content script, top
  // frame of a tab).
  const fromPage = (msg, url, sender = {}) =>
    sendInternal(
      { ohSite: msg },
      { id: chrome.runtime.id, tab: { id: 1 }, frameId: 0, url, ...sender },
    );
  // An alarm going off, and a notification clicked (Extension Alerts).
  const fireAlarm = (name) => Promise.all(onAlarm.map((f) => f({ name })));
  const clickNote = (id) => Promise.all(onNoteClick.map((f) => f(id)));
  // The browser has an update ready (runtime.onUpdateAvailable).
  const updateAvailable = (details) => Promise.all(onUpdate.map((f) => f(details)));
  // The hidden scan page's message (src/scan-host.js): an extension page at its address
  // with `query` (?run=…), no tab.
  const fromScanPage = (msg, query = '', sender = {}) =>
    sendInternal(msg, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(`src/scan.html${query}`),
      ...sender,
    });
  return {
    send,
    sendInternal,
    fromPage,
    fromScanPage,
    updateAvailable,
    stores: { local, session },
    opened,
    focused,
    alarms,
    notes,
    fireAlarm,
    clickNote,
    docs,
    frames: frameList,
    sent,
    reloaded,
    ctx,
    chrome,
  };
}

module.exports = {
  FRONT,
  APP,
  HANGAR,
  STAGING,
  HANGAR_STAGING,
  CHROME_ID,
  FIREFOX_ID,
  STORE_FLAGS,
  pagesFor,
  cutFlags,
  builtPages,
  builtBridge,
  loadBackground,
};
