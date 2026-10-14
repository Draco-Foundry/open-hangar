// The hidden scan page in a build (src/scan-host.js, src/scan.html): what a connector
// build has for it, per browser, and a build without the connector doesn't. Used by
// scripts/pack.mjs (to build it), scripts/check-store-build.mjs (to check a build agrees
// with its flags) and test/privacy-permissions.test.js (the policy must explain what a
// store or beta build asks for).
//
// With the connector on, scans run in src/scan.html instead of a tab:
//   Chrome and Edge (the store build and the Chromium beta): an offscreen document, so
//     the `offscreen` permission (no install warning). Never on Firefox, which has no
//     such API (its lint warns about a permission it doesn't know).
//   Firefox: a hidden frame in its event page, so its pages' content security policy
//     lets a frame of the extension's own pages in (`frame-src 'self'`; manifest.json
//     says 'none', which stays everywhere else).
// The worker script (src/scan-host.js) is imported by src/background.js on Chrome and
// listed in Firefox's event page; the shim (src/scan-shim.js) is the page's own.
// Without the connector: none of it.

// src/scan.html itself is one of the connector's pages (scripts/connector.mjs).
export const SCAN_HOST_FILES = ['src/scan-host.js', 'src/scan-shim.js'];
export const SCAN_HOST_WORKER = 'src/scan-host.js';
export const SCAN_HOST_PERMISSIONS = ['offscreen'];
const FRAME_NONE = "frame-src 'none'";
export const FRAME_SELF = "frame-src 'self'";

// The permissions a build with these flags asks for on top of manifest.json's (and
// alerts'), for one browser.
export const scanHostPermissions = (flags, { firefox = false } = {}) =>
  flags.connector && !firefox ? [...SCAN_HOST_PERMISSIONS] : [];

// The manifest for one browser with the hidden page's needs added (a copy), or as it is.
export function withScanHost(manifest, flags, { firefox = false } = {}) {
  if (!flags.connector) return manifest;
  if (firefox) {
    const csp = manifest.content_security_policy || {};
    const pages = csp.extension_pages || '';
    if (pages.split(FRAME_NONE).length !== 2)
      throw new Error(`manifest.json: expected one "${FRAME_NONE}" in extension_pages`);
    return {
      ...manifest,
      content_security_policy: { ...csp, extension_pages: pages.replace(FRAME_NONE, FRAME_SELF) },
    };
  }
  const uniq = (xs) => [...new Set(xs)];
  return {
    ...manifest,
    permissions: uniq([...(manifest.permissions || []), ...scanHostPermissions(flags)]),
  };
}

// A build that doesn't agree with its connector flag about the hidden page → its
// problems ([] when fine). `files`: every path in it; `manifest`: the built one;
// `firefox`: Firefox's build.
export function scanHostProblems(unit, { files, manifest, connector, firefox }) {
  const problems = [];
  const perms = manifest.permissions || [];
  const optional = manifest.optional_permissions || [];
  const scripts = (manifest.background && manifest.background.scripts) || [];
  const csp = manifest.content_security_policy?.extension_pages || '';
  const frames = csp.match(/frame-src [^;]*/g) || [];
  for (const p of SCAN_HOST_PERMISSIONS)
    if (optional.includes(p)) problems.push(`${unit}: ${p} is optional (scans need it)`);
  if (connector) {
    for (const f of SCAN_HOST_FILES) if (!files.has(f)) problems.push(`${unit}: ${f} is missing`);
    if (firefox) {
      if (!scripts.includes(SCAN_HOST_WORKER))
        problems.push(`${unit}: Firefox's event page doesn't load ${SCAN_HOST_WORKER}`);
      for (const p of SCAN_HOST_PERMISSIONS)
        if (perms.includes(p)) problems.push(`${unit}: the ${p} permission on Firefox`);
      if (frames.join() !== FRAME_SELF)
        problems.push(`${unit}: Firefox's pages need ${FRAME_SELF} for the hidden scan page`);
    } else {
      for (const p of SCAN_HOST_PERMISSIONS)
        if (!perms.includes(p)) problems.push(`${unit}: no ${p} permission (the hidden scan page)`);
      if (frames.join() !== FRAME_NONE) problems.push(`${unit}: its pages may hold frames`);
    }
  } else {
    for (const f of SCAN_HOST_FILES)
      if (files.has(f)) problems.push(`${unit}: ${f} without the connector`);
    for (const p of SCAN_HOST_PERMISSIONS)
      if (perms.includes(p)) problems.push(`${unit}: the ${p} permission without the connector`);
    if (frames.join() !== FRAME_NONE) problems.push(`${unit}: its pages may hold frames`);
  }
  return problems;
}
