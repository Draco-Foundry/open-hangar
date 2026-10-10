'use strict';
// The background worker (src/background.js) as scripts/pack.mjs builds it, in a
// sandbox with a stand-in browser: its flags written into flags.js, its pages into
// site-pages.js (bridge v2), the code of every flag that's off cut, and a fake
// chrome API (storage, tabs, the two message listeners). Used by the bridge tests
// (test/bridge-v2.test.js, test/site-connect.test.js, test/rsi-cart.test.js).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

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

// chrome.storage's areas: copies in and out, as the real one.
function area(data) {
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
    set: async (o) => void Object.assign(data, structuredClone(o)),
    remove: async (k) => void [].concat(k).forEach((x) => delete data[x]),
  };
}

// browser: 'chrome' (Chrome and Edge, with the identity API), 'firefox' (desktop),
// 'firefox-android' (Firefox's manifest, no identity API) or 'bare' (neither).
// flags: the build's flags; pages: its page lists (default: the store's for those
// flags, with staging's for staging: true). local and session: what storage holds.
// granted: Firefox's data permission. contexts: runtime.getContexts' answer (null:
// a browser without it). fetch: the network (RSI's stand-in for Add to RSI Cart).
function loadBackground({
  browser = 'chrome',
  flags = { sync: true, orgFleet: false, localMode: true },
  staging = false,
  pages = pagesFor({ ...flags, staging }),
  local = {},
  session = {},
  granted = true,
  contexts = null,
  fetch = async () => {
    throw new Error('no network here');
  },
  globals = {},
} = {}) {
  const firefox = browser === 'firefox' || browser === 'firefox-android';
  const listen = () => ({ addListener() {} });
  let external = null;
  let internal = null;
  const opened = [];
  const focused = [];
  let nextTab = 100;
  const chrome = {
    storage: { local: area(local), session: area(session), onChanged: listen() },
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
    permissions: { contains: async () => granted },
    runtime: {
      id: firefox ? FIREFOX_ID : CHROME_ID,
      onInstalled: listen(),
      onStartup: listen(),
      onUpdateAvailable: listen(),
      // Chrome and Firefox both have both; Firefox's pages never reach the first.
      onMessageExternal: { addListener: (f) => (external = f) },
      onMessage: { addListener: (f) => (internal = f) },
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
      ...(contexts ? { getContexts: async () => structuredClone(contexts) } : {}),
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
  const ctx = { chrome, console, crypto, TextEncoder, btoa, URL, setTimeout, fetch, ...globals };
  ctx.self = ctx;
  vm.createContext(ctx);
  ctx.importScripts = (...names) => {
    for (const f of names)
      vm.runInContext(files[f] ? files[f]() : read(f), ctx, { filename: `src/${f}` });
  };
  vm.runInContext(cutFlags(read('background.js'), flags), ctx, { filename: 'src/background.js' });

  // Answers come back copied out of the sandbox, so deepEqual compares plain values;
  // undefined = no answer at all (the listener let the message go).
  const answer = (listener, msg, sender) =>
    new Promise((res) => {
      if (!listener) return res(undefined);
      const later = listener(msg, sender, (r) =>
        res(r === undefined ? r : JSON.parse(JSON.stringify(r))),
      );
      if (!later) res(undefined);
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
  return {
    send,
    sendInternal,
    fromPage,
    stores: { local, session },
    opened,
    focused,
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
  pagesFor,
  cutFlags,
  builtPages,
  builtBridge,
  loadBackground,
};
