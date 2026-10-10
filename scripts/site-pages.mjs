// The web pages that may talk to the extension (bridge v2, src/site-pages.js): each
// build's lists, decided here once and written into the three places that use them.
// The manifest (externally_connectable on Chrome and Edge, the site bridge's matches
// on Firefox), the built src/site-pages.js (what the background worker checks every
// message against) and the built src/site-bridge.js (the bridge's own copy). Used by
// scripts/pack.mjs, which writes them and checks the build it made, and
// scripts/check-store-build.mjs, which checks a packed build's copies agree.
import vm from 'node:vm';

// Our pages. The hangar page only with the `localMode` flag on; Connect only on the app
// (never the public front page) and only with `sync` on.
export const HANGAR_PAGE = 'https://hangar.openhangar.space';
export const FRONT_PAGE = 'https://openhangar.space';
export const SITE_PAGES = [FRONT_PAGE, 'https://app.openhangar.space'];
// Staging's, only in a developer's build pointed at another site (npm run
// build:staging). Never in a store build, the beta included.
const STAGING_HANGAR = 'https://hangar-staging.openhangar.space';
const STAGING_SITE = 'https://staging.openhangar.space';

// { hangar, site, connect }: origins, in the order the manifest lists them.
export function pagesFor({ localMode = false, sync = false, devSite = false } = {}) {
  const hangar = localMode ? [HANGAR_PAGE, ...(devSite ? [STAGING_HANGAR] : [])] : [];
  const site = [...SITE_PAGES, ...(devSite ? [STAGING_SITE] : [])];
  const connect = sync ? site.filter((o) => o !== FRONT_PAGE) : [];
  return { hangar, site, connect };
}
// The manifest's patterns: "https://host" → "https://host/*", hangar pages first.
export const patternsOf = (pages) => [...pages.hangar, ...pages.site].map((o) => `${o}/*`);

const PAGES_LINE = 'const BUILD_PAGES = { hangar: [], site: [], connect: [] };';
const BRIDGE_LINE = 'const PAGES = [];';
function replaceOnce(text, line, value, file) {
  if (text.split(line).length !== 2) throw new Error(`${file}: expected one "${line}"`);
  return text.replace(line, value);
}
// The built src/site-pages.js and src/site-bridge.js, with this build's lists.
export const writePages = (text, pages, file = 'src/site-pages.js') =>
  replaceOnce(text, PAGES_LINE, `const BUILD_PAGES = ${JSON.stringify(pages)};`, file);
export const writeBridgePages = (text, pages, file = 'src/site-bridge.js') =>
  replaceOnce(
    text,
    BRIDGE_LINE,
    `const PAGES = ${JSON.stringify([...pages.hangar, ...pages.site])};`,
    file,
  );

// A built src/site-pages.js, run in a sandbox: its lists, as plain data.
export function readPages(text, file = 'src/site-pages.js') {
  const ctx = vm.createContext({ TextEncoder });
  ctx.self = ctx;
  vm.runInContext(text, ctx, { filename: file });
  if (!ctx.OHPages?.pages) throw new Error(`${file}: doesn't set OHPages`);
  return JSON.parse(JSON.stringify(ctx.OHPages.pages));
}
// A built src/site-bridge.js: its own list of pages.
export function readBridgePages(text, file = 'src/site-bridge.js') {
  const m = /^\s*const PAGES = (\[[^\]\n]*\]);$/m.exec(text);
  if (!m) throw new Error(`${file}: no "const PAGES = [...];" line`);
  return JSON.parse(m[1]);
}
// The page lists' own lines, left out where a build without sync is checked for the
// sync site's address (they list our own pages for Add to RSI Cart, as the manifest does).
export const withoutPageLists = (text) =>
  text.replace(/^\s*const (BUILD_PAGES|PAGES) = .*;$/gm, '');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const EXACT = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\/\*$/;

// One build's way in, as it was built → its problems (none: []). `name` names the
// build in the messages; `bridge` is the built bridge's list (Firefox), `flags` the
// build's own flag values.
export function pagesProblems(name, { manifest, pages, bridge = null, firefox, flags }) {
  const out = [];
  const want = patternsOf(pages);
  for (const p of want)
    if (!EXACT.test(p)) out.push(`${name}: "${p}" isn't an exact https://host/* pattern`);
  if (firefox) {
    if (manifest.externally_connectable)
      out.push(`${name}: externally_connectable (Firefox uses src/site-bridge.js)`);
    const scripts = manifest.content_scripts || [];
    const b = scripts[0] || {};
    if (scripts.length !== 1 || !same(b.js, ['src/site-bridge.js']))
      out.push(`${name}: content scripts other than the one site bridge`);
    if (!same(b.matches, want))
      out.push(
        `${name}: the site bridge's matches (${JSON.stringify(b.matches)}) don't agree with src/site-pages.js (${JSON.stringify(want)})`,
      );
    if (b.run_at !== 'document_start') out.push(`${name}: the site bridge isn't document_start`);
    if (b.all_frames || b.match_about_blank || b.match_origin_as_fallback)
      out.push(`${name}: the site bridge runs in frames (top frame only)`);
    if (!same(bridge, [...pages.hangar, ...pages.site]))
      out.push(
        `${name}: src/site-bridge.js's own list (${JSON.stringify(bridge)}) doesn't agree with src/site-pages.js`,
      );
  } else {
    const ec = manifest.externally_connectable || {};
    if (!same(Object.keys(ec), ['matches']))
      out.push(`${name}: externally_connectable has more than matches (${Object.keys(ec)})`);
    if (!same(ec.matches, want))
      out.push(
        `${name}: externally_connectable (${JSON.stringify(ec.matches)}) doesn't agree with src/site-pages.js (${JSON.stringify(want)})`,
      );
    if (manifest.content_scripts) out.push(`${name}: content scripts in the Chrome and Edge build`);
  }
  if (!!pages.hangar.length !== !!flags.localMode)
    out.push(
      `${name}: ${pages.hangar.length ? 'the hangar page' : 'no hangar page'} with localMode ${flags.localMode ? 'on' : 'off'}`,
    );
  if (!!pages.connect.length !== !!flags.sync)
    out.push(
      `${name}: ${pages.connect.length ? 'Connect pages' : 'no Connect page'} with sync ${flags.sync ? 'on' : 'off'}`,
    );
  for (const o of pages.connect)
    if (o === FRONT_PAGE || !pages.site.includes(o))
      out.push(`${name}: Connect on ${o}, which isn't one of the app's pages`);
  return out;
}
