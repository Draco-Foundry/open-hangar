// The connector build (src/flags.js `connector`, docs/FLAGS.md): what's in it and what
// isn't. Used by scripts/pack.mjs (to build it) and scripts/check-store-build.mjs (to
// check a build agrees with its flags).
//
// With the connector on, the extension is the popup, the basic page and the hidden scan
// page (src/scan.html, scripts/scan-host.mjs): the full dashboard and its Svelte pages
// stay in the repo (until the website's versions and
// Local Mode work on staging) but are left out of the build. src/ui/ keeps only what
// the connector's pages load, found by following their imports, so a page added to the
// dashboard later never slips in. Its extension pages may only send requests to RSI,
// openhangar.space and the sync site (connect-src), which is the whole outbound list.
// Without the connector, the popup and the basic page are left out instead.
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

export const CONNECTOR_PAGES = ['src/popup.html', 'src/basic.html', 'src/scan.html'];
// The connector's entry bundles and stylesheets in src/ui (vite.config.mjs).
export const UI_ENTRIES = [
  'popup.js',
  'basic.js',
  'scan.js',
  'popup.css',
  'basic.css',
  'tokens.css',
];
// The dashboard's own files outside src/ui (CHANGELOG.md is read by its Updates page),
// and its folders: src/assets holds its banner and footer pictures.
export const DASHBOARD_FILES = [
  'src/dashboard.html',
  'src/dashboard.js',
  'src/safe-html.js',
  'src/quips.js',
  'src/qr.js',
  'CHANGELOG.md',
];
export const DASHBOARD_DIRS = ['src/assets'];

// The hosts a connector build's pages may send requests to (with the sync site).
export const CONNECT_HOSTS = ['https://robertsspaceindustries.com', 'https://openhangar.space'];
export const connectSrc = (site) =>
  `connect-src 'self' ${[...CONNECT_HOSTS, ...(site ? [site] : [])].join(' ')}`;

// What src/ui files the connector's pages need: the entries, every chunk they import
// (statement imports only: the bundles keep comments that look like imports), and the
// fonts their stylesheets name. `read(f)` gives a src/ui file's text (null when it isn't
// there). → a Set of paths relative to src/ui.
export function connectorUi(read) {
  const keep = new Set();
  const todo = UI_ENTRIES.filter((f) => read(f) != null);
  while (todo.length) {
    const f = todo.pop();
    if (keep.has(f)) continue;
    const text = read(f);
    if (text == null) continue;
    keep.add(f);
    if (f.endsWith('.js')) {
      const re =
        /^\s*(?:import|export)\b[^'"\n]*?\bfrom\s*"(\.\/[^"]+)"|^\s*import\s*"(\.\/[^"]+)"/gm;
      for (const m of text.matchAll(re)) todo.push(path.posix.normalize(m[1] || m[2]));
    } else if (f.endsWith('.css')) {
      for (const m of text.matchAll(/url\(\s*['"]?(\.\/[^'")]+)['"]?\s*\)/g))
        keep.add(path.posix.normalize(m[1]));
    }
  }
  return keep;
}

// Every file under a folder, as paths relative to it with forward slashes.
export function filesUnder(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}
const readIn = (dir) => (f) => {
  const p = path.join(dir, f);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

// Leaves a built copy (dist/<target>) as the connector: the dashboard's files and every
// src/ui file its pages don't load go. → the removed paths.
export function trimToConnector(out) {
  const removed = [];
  for (const f of DASHBOARD_FILES)
    if (existsSync(path.join(out, f))) {
      rmSync(path.join(out, f));
      removed.push(f);
    }
  for (const d of DASHBOARD_DIRS)
    if (existsSync(path.join(out, d))) {
      rmSync(path.join(out, d), { recursive: true });
      removed.push(`${d}/`);
    }
  const ui = path.join(out, 'src', 'ui');
  if (!existsSync(ui)) return removed;
  const keep = connectorUi(readIn(ui));
  for (const f of filesUnder(ui))
    if (!keep.has(f)) {
      rmSync(path.join(ui, f));
      removed.push(`src/ui/${f}`);
    }
  for (const d of readdirSync(ui))
    if (statSync(path.join(ui, d)).isDirectory() && !readdirSync(path.join(ui, d)).length)
      rmSync(path.join(ui, d), { recursive: true });
  return removed;
}

// A build that doesn't agree with its connector flag → its problems ([] when fine).
// `files`: every path in it (relative to its root); `read(f)`: a text file's contents;
// `manifest`: the built one; `site`: the sync site built in (for connect-src);
// `refs: false` skips checking the pages' scripts are there (a build made before the
// Svelte pages were, as npm test does; the store check always checks). Works the same
// on a dist/ folder and on a zip.
export function connectorProblems(unit, { files, read, manifest, connector, site, refs = true }) {
  const problems = [];
  const has = (f) => files.has(f);
  const csp = manifest.content_security_policy?.extension_pages || '';
  if (connector) {
    if (manifest.action?.default_popup !== 'src/popup.html')
      problems.push(`${unit}: the connector's toolbar popup isn't src/popup.html`);
    // Its keyboard shortcut (manifest.json commands, Alt+Shift+H): the browser opens the
    // popup itself, no permission needed. The popup shows it in Settings.
    if (!manifest.commands?._execute_action?.suggested_key?.default)
      problems.push(`${unit}: no keyboard shortcut opens the popup (commands._execute_action)`);
    for (const f of CONNECTOR_PAGES) if (!has(f)) problems.push(`${unit}: ${f} is missing`);
    for (const f of DASHBOARD_FILES)
      if (has(f)) problems.push(`${unit}: ${f} is in a connector build`);
    for (const d of DASHBOARD_DIRS)
      if ([...files].some((f) => f.startsWith(`${d}/`)))
        problems.push(`${unit}: ${d}/ is in a connector build`);
    const ui = [...files].filter((f) => f.startsWith('src/ui/')).map((f) => f.slice(7));
    const keep = connectorUi((f) => (has(`src/ui/${f}`) ? read(`src/ui/${f}`) : null));
    for (const f of ui)
      if (!keep.has(f)) problems.push(`${unit}: src/ui/${f} isn't the connector's`);
    if (!csp.includes(connectSrc(site)))
      problems.push(`${unit}: its pages may send requests beyond ${connectSrc(site)}`);
    // Every script and stylesheet the connector's pages name is in the build.
    for (const page of refs ? CONNECTOR_PAGES.filter(has) : [])
      for (const m of read(page).matchAll(/\b(?:src|href)="([^"]+)"/g))
        if (!/^[a-z]+:/.test(m[1]) && !has(path.posix.join(path.posix.dirname(page), m[1])))
          problems.push(`${unit}: ${page} loads ${m[1]}, which isn't in the build`);
  } else {
    if (manifest.action?.default_popup)
      problems.push(`${unit}: a toolbar popup without the connector`);
    for (const f of CONNECTOR_PAGES)
      if (has(f)) problems.push(`${unit}: ${f} without the connector`);
    if (/connect-src/.test(csp)) problems.push(`${unit}: connect-src without the connector`);
  }
  return problems;
}

// A dist/<target> folder's files and reader, for connectorProblems.
export const folderBuild = (out) => ({ files: new Set(filesUnder(out)), read: readIn(out) });
