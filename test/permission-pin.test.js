'use strict';
// The permission pin: every manifest a store or beta build ships (Chrome and Edge share
// one, Firefox has its own) asks for nothing beyond ALLOWED. A new permission, optional
// permission, host permission, content script match or externally_connectable entry
// fails here, even one the policy explains. Built for real by scripts/pack.mjs in a
// scratch copy, the way test/beta-build.test.js does. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

// What docs/PRIVACY.md ("Permissions and why they are used") explains today, and
// nothing more. CHANGING THIS LIST MEANS CHANGING THE PRIVACY POLICY FIRST (both
// docs/PRIVACY.md and site/privacy.html, owner-approved words): add the policy's
// note, then the entry here, never the other way round.
const ALLOWED = {
  // alarms and the optional notifications: store alerts (the policy's "alarms" and
  // "notifications", owner-approved 2026-10-13).
  permissions: ['storage', 'unlimitedStorage', 'cookies', 'identity', 'alarms'],
  optional_permissions: ['notifications'],
  host_permissions: ['https://robertsspaceindustries.com/*'],
  optional_host_permissions: [],
  // Our own pages only ("Messages from openhangar.space"): externally_connectable on
  // Chrome and Edge, the site bridge content script on Firefox.
  site_pages: [
    'https://openhangar.space/*',
    'https://app.openhangar.space/*',
    'https://hangar.openhangar.space/*',
  ],
  // The only script the extension runs on any web page: the Firefox site bridge.
  content_script_files: ['src/site-bridge.js'],
};

// scripts/pack.mjs (or --beta) in a scratch copy of what it builds from.
function build(args) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-pin-'));
  for (const f of ['manifest.json', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  for (const d of ['_locales', 'icons', 'src', 'beta'])
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack.mjs'), ...args], {
    cwd: dir,
    env: { ...process.env, OH_SYNC: '', OH_SITE: '' },
    stdio: 'pipe',
  });
  return dir;
}

const extra = (got, allowed) => (got || []).filter((x) => !allowed.includes(x));

function pinProblems(name, m) {
  const out = [];
  const say = (what, list) => list.length && out.push(`${name}: ${what} ${list.join(', ')}`);
  say('asks for', extra(m.permissions, ALLOWED.permissions));
  say('may ask for', extra(m.optional_permissions, ALLOWED.optional_permissions));
  say('reaches', extra(m.host_permissions, ALLOWED.host_permissions));
  say('may reach', extra(m.optional_host_permissions, ALLOWED.optional_host_permissions));
  for (const cs of m.content_scripts || []) {
    say('runs on', extra(cs.matches, ALLOWED.site_pages));
    say('runs on every page that', extra(cs.include_globs, []));
    say('injects', extra(cs.js, ALLOWED.content_script_files));
    say('injects styles', extra(cs.css, []));
    if (cs.all_frames) out.push(`${name}: runs in every frame`);
  }
  const ec = m.externally_connectable;
  if (ec) {
    say('lets these pages message it:', extra(ec.matches, ALLOWED.site_pages));
    say('lets these extensions message it:', extra(ec.ids, []));
    if (ec.accepts_tls_channel_id) out.push(`${name}: accepts TLS channel ids`);
  }
  return out;
}

for (const [label, args, outputs] of [
  ['store', [], ['chrome', 'firefox']],
  ['beta', ['--beta'], ['beta', 'beta-firefox']],
]) {
  test(`${label} build: every browser's manifest stays inside the pinned permissions`, () => {
    const dir = build(args);
    try {
      const problems = [];
      for (const out of outputs) {
        const m = JSON.parse(fs.readFileSync(path.join(dir, 'dist', out, 'manifest.json'), 'utf8'));
        problems.push(...pinProblems(out, m));
      }
      assert.deepEqual(problems, [], 'the privacy policy has to change first (see ALLOWED)');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('the pin itself catches each kind of addition', () => {
  const base = {
    permissions: ['storage'],
    host_permissions: ['https://robertsspaceindustries.com/*'],
    externally_connectable: { matches: ['https://app.openhangar.space/*'] },
  };
  assert.deepEqual(pinProblems('x', base), []);
  assert.equal(pinProblems('x', { ...base, permissions: ['storage', 'tabs'] }).length, 1);
  assert.equal(pinProblems('x', { ...base, optional_permissions: ['downloads'] }).length, 1);
  assert.equal(pinProblems('x', { ...base, host_permissions: ['<all_urls>'] }).length, 1);
  assert.equal(pinProblems('x', { ...base, optional_host_permissions: ['https://*/*'] }).length, 1);
  assert.equal(
    pinProblems('x', {
      ...base,
      content_scripts: [{ matches: ['https://example.com/*'], js: ['src/site-bridge.js'] }],
    }).length,
    1,
  );
  assert.equal(
    pinProblems('x', {
      ...base,
      externally_connectable: { matches: ['https://example.com/*'], ids: ['*'] },
    }).length,
    2,
  );
});
