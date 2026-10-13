// Extension Alerts in a build (src/flags.js `alerts`, docs/FLAGS.md "Alerts"): what a
// build with the flag has and one without doesn't. Used by scripts/pack.mjs (to build
// it) and scripts/check-store-build.mjs (to check a build agrees with its flags), and by
// test/privacy-permissions.test.js (the policy must explain what a store or beta build
// asks for).
//
// With it on: src/alerts.js (the background worker imports it; Firefox's event page
// lists it), the `alarms` permission for the checks (no install warning), and
// `notifications` as an optional permission, asked only when the pilot turns alerts on
// (owner, 2026-10-10). Never `notifications` as a required one. Off: none of them.

export const ALERTS_FILES = ['src/alerts.js'];
export const ALERTS_PERMISSIONS = ['alarms'];
export const ALERTS_OPTIONAL = ['notifications'];

// The permissions a build with these flags asks for on top of manifest.json's.
export const alertsPermissions = (flags) =>
  flags.alerts ? { permissions: ALERTS_PERMISSIONS, optional: ALERTS_OPTIONAL } : null;

// The manifest with the alerts' permissions added (a copy), or as it is.
export function withAlerts(manifest, flags) {
  const add = alertsPermissions(flags);
  if (!add) return manifest;
  const uniq = (xs) => [...new Set(xs)];
  return {
    ...manifest,
    permissions: uniq([...(manifest.permissions || []), ...add.permissions]),
    optional_permissions: uniq([...(manifest.optional_permissions || []), ...add.optional]),
  };
}

// A build that doesn't agree with its alerts flag → its problems ([] when fine).
// `files`: every path in it; `manifest`: the built one; `firefox`: Firefox's build.
export function alertsProblems(unit, { files, manifest, alerts, firefox }) {
  const problems = [];
  const perms = manifest.permissions || [];
  const optional = manifest.optional_permissions || [];
  const scripts = (manifest.background && manifest.background.scripts) || [];
  if (alerts) {
    for (const f of ALERTS_FILES) {
      if (!files.has(f)) problems.push(`${unit}: ${f} is missing`);
      if (firefox && !scripts.includes(f))
        problems.push(`${unit}: Firefox's event page doesn't load ${f}`);
    }
    for (const p of ALERTS_PERMISSIONS)
      if (!perms.includes(p)) problems.push(`${unit}: no ${p} permission (the alerts' checks)`);
    for (const p of ALERTS_OPTIONAL) {
      if (!optional.includes(p)) problems.push(`${unit}: ${p} isn't an optional permission`);
      if (perms.includes(p)) problems.push(`${unit}: ${p} is required (it's asked for, optional)`);
    }
  } else {
    for (const f of ALERTS_FILES) if (files.has(f)) problems.push(`${unit}: ${f} without alerts`);
    for (const p of [...ALERTS_PERMISSIONS, ...ALERTS_OPTIONAL])
      if (perms.includes(p) || optional.includes(p))
        problems.push(`${unit}: the ${p} permission without alerts`);
  }
  return problems;
}
