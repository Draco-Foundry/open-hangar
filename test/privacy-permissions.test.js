'use strict';
// The privacy policy explains every permission the extension asks for, in the same
// words in docs/PRIVACY.md and the site's copy (site/privacy.html). A permission added
// to manifest.json, a new way for our website to reach the extension
// (scripts/pack.mjs), or a page of ours a store or beta build newly lets in
// (scripts/site-pages.mjs), fails here until the policy says why. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pack = read('scripts/pack.mjs');

// "Permissions and Why They Are Used", one entry per bullet, as plain text.
const plain = (s) => s.replace(/\s+/g, ' ').trim();
function mdBullets() {
  const md = read('docs/PRIVACY.md');
  const sec = /\n## Permissions and why they are used\n([\s\S]*?)\n## /i.exec(md);
  assert.ok(sec, 'docs/PRIVACY.md has a permissions section');
  return sec[1]
    .split(/\n- /)
    .slice(1)
    .map((b) => plain(b.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')));
}
function htmlBullets() {
  const html = read('site/privacy.html');
  const sec = /<h2>Permissions and Why They Are Used<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i.exec(html);
  assert.ok(sec, 'site/privacy.html has a permissions section');
  // The text between the tags (our own page, read here, never shown anywhere).
  return [...sec[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
    plain(m[1].split(/<[^>]*>/).join('')),
  );
}
const named = (bullets, label) => bullets.some((b) => b.startsWith(`${label}:`));

test('every manifest permission has a note in both copies of the policy', () => {
  const perms = [...(manifest.permissions || []), ...(manifest.optional_permissions || [])];
  assert.ok(perms.length, 'manifest.json lists permissions');
  const md = mdBullets();
  const html = htmlBullets();
  for (const p of perms) {
    assert.ok(named(md, p), `docs/PRIVACY.md explains "${p}"`);
    assert.ok(named(html, p), `site/privacy.html explains "${p}"`);
  }
  for (const h of manifest.host_permissions || []) {
    const host = new URL(h.replace(/\*\.?/g, '')).hostname;
    const label = `Host access to ${host}`;
    assert.ok(named(md, label), `docs/PRIVACY.md explains host access to ${host}`);
    assert.ok(named(html, label), `site/privacy.html explains host access to ${host}`);
  }
});

test("the website's way in has a note while the build adds one", (t) => {
  if (!/externally_connectable|site-bridge\.js/.test(pack))
    return t.skip('scripts/pack.mjs gives openhangar.space no way in');
  assert.ok(named(mdBullets(), 'Messages from openhangar.space'), 'docs/PRIVACY.md');
  assert.ok(named(htmlBullets(), 'Messages from openhangar.space'), 'site/privacy.html');
});

// The pages a store or beta build lets talk to the extension (scripts/site-pages.mjs,
// for that build's flags) are each named in that note, so a flag that lets a new page
// in (our hangar page, with localMode) fails here until the policy says so.
test('every page a store or beta build lets in is named in both copies of the policy', async () => {
  const { buildValues, readRegistry } = await import('../scripts/build-flags.mjs');
  const { pagesFor } = await import('../scripts/site-pages.mjs');
  const registry = readRegistry(path.join(ROOT, 'src', 'flags.js'));
  const note = (bullets) => bullets.find((b) => b.startsWith('Messages from openhangar.space:'));
  const copies = [
    ['docs/PRIVACY.md', note(mdBullets())],
    ['site/privacy.html', note(htmlBullets())],
  ];
  for (const [build, beta] of [
    ['store', false],
    ['beta', true],
  ]) {
    const flags = buildValues(registry, { beta });
    const pages = pagesFor({ localMode: flags.localMode, sync: flags.sync });
    for (const origin of [...pages.hangar, ...pages.site]) {
      const host = new URL(origin).hostname;
      // The host itself, not just the end of a longer one (app.openhangar.space).
      const own = new RegExp(
        `(^|[^\\w.-])${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-]|\\.\\w)`,
      );
      for (const [file, text] of copies)
        assert.ok(own.test(text || ''), `${file} names ${host} (the ${build} build lets it in)`);
    }
  }
});

test('both copies of the policy explain permissions in the same words', () => {
  assert.deepEqual(htmlBullets(), mdBullets());
});

// Extension Alerts (scripts/alerts.mjs): a store or beta build with the `alerts` flag on
// asks for `alarms` and an optional `notifications`, downloads the public sale feed and,
// while connected, reads the account's Wishlist keys. Each fails here until both copies
// of the policy say so (owner-approved words, word for word).
test('a store or beta build with alerts on: the policy explains its permissions and requests', async () => {
  const { buildValues, readRegistry } = await import('../scripts/build-flags.mjs');
  const { alertsPermissions } = await import('../scripts/alerts.mjs');
  const registry = readRegistry(path.join(ROOT, 'src', 'flags.js'));
  const copies = [
    ['docs/PRIVACY.md', read('docs/PRIVACY.md'), mdBullets()],
    ['site/privacy.html', read('site/privacy.html'), htmlBullets()],
  ];
  // What a build with the flag adds, checked here so a change to scripts/alerts.mjs
  // can't quietly skip the policy.
  assert.deepEqual(alertsPermissions({ alerts: true }), {
    permissions: ['alarms'],
    optional: ['notifications'],
  });
  for (const [build, beta] of [
    ['store', false],
    ['beta', true],
  ]) {
    const add = alertsPermissions(buildValues(registry, { beta }));
    if (!add) continue;
    for (const [file, text, bullets] of copies) {
      for (const p of [...add.permissions, ...add.optional])
        assert.ok(named(bullets, p), `${file} explains "${p}" (the ${build} build has alerts)`);
      for (const req of ['/api/store/on-sale', '/api/v1/wishlist'])
        assert.ok(text.includes(req), `${file} names ${req} (the ${build} build has alerts)`);
    }
  }
});

// The hidden scan page (scripts/scan-host.mjs): a store or beta build with the connector
// asks for `offscreen` on Chrome and Edge, never on Firefox, and pack.mjs adds it per
// browser, so manifest.json (the first test) never shows it. It fails here until both
// copies of the policy explain it and say which browsers (owner-approved words
// 2026-10-14, word for word).
test('a store or beta build with the connector: the policy explains offscreen', async () => {
  const { buildValues, readRegistry } = await import('../scripts/build-flags.mjs');
  const { scanHostPermissions } = await import('../scripts/scan-host.mjs');
  const registry = readRegistry(path.join(ROOT, 'src', 'flags.js'));
  // What each browser's build adds, checked here so a change to scripts/scan-host.mjs
  // can't quietly skip the policy.
  assert.deepEqual(scanHostPermissions({ connector: true }), ['offscreen']);
  assert.deepEqual(scanHostPermissions({ connector: true }, { firefox: true }), []);
  assert.deepEqual(scanHostPermissions({ connector: false }), []);
  // A permission only some browsers ask for names them before its colon.
  const noted = (bullets, p) => bullets.some((b) => new RegExp(`^${p}( \\([^)]*\\))?:`).test(b));
  const copies = [
    ['docs/PRIVACY.md', mdBullets()],
    ['site/privacy.html', htmlBullets()],
  ];
  for (const [build, beta] of [
    ['store', false],
    ['beta', true],
  ])
    for (const p of scanHostPermissions(buildValues(registry, { beta })))
      for (const [file, bullets] of copies) {
        assert.ok(noted(bullets, p), `${file} explains "${p}" (the ${build} build has it)`);
        assert.ok(
          bullets.some((b) => b.startsWith(`${p} (Chrome and Edge only):`)),
          `${file} says only Chrome and Edge ask for "${p}"`,
        );
      }
});

// Auto Scan Daily (the `autoScanRun` flag, in place of the Daily Scan Reminder, #666): a
// store or beta build with it on fails here until both copies of the policy have its
// section (#auto-scan-daily, owner-approved words 2026-11-01, word for word) with the
// account check first and the quick check, name it in the alarms and notifications
// bullets and the status file, say Disconnect turns it off, and no longer describe the
// reminder; and while the flag needs the reminder's alarms and notifications.
test('a store or beta build with Auto Scan Daily on: the policy explains it', async () => {
  const { buildValues, readRegistry } = await import('../scripts/build-flags.mjs');
  const registry = readRegistry(path.join(ROOT, 'src', 'flags.js'));
  const words = (f) =>
    plain(
      read(f)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
    ).replace(/ ([.,:;)])/g, '$1');
  const SAID = [
    'Auto Scan Daily scans your hangar for you once a day, without a click.',
    'When: once a day, at a random time, while your browser is open.',
    'it reads nothing more and keeps nothing, and shows a notification asking you to scan yourself. It never switches accounts.',
    "except buy-backs' own pages, from your own RSI account only.",
    'It waits about a second between pages and stops if RSI asks it to slow down.',
  ];
  let checked = 0;
  for (const [build, beta] of [
    ['store', false],
    ['beta', true],
  ]) {
    const flags = buildValues(registry, { beta });
    if (!flags.autoScanRun) continue;
    assert.ok(flags.autoScan && flags.alerts, `the ${build} build has the reminder's alarm`);
    checked++;
    assert.match(read('docs/PRIVACY.md'), /\n## Auto Scan Daily\n/, 'docs/PRIVACY.md');
    assert.match(read('site/privacy.html'), /<h2 id="auto-scan-daily">Auto Scan Daily<\/h2>/);
    for (const [file, bullets] of [
      ['docs/PRIVACY.md', mdBullets()],
      ['site/privacy.html', htmlBullets()],
    ]) {
      const text = words(file);
      for (const s of SAID) assert.ok(text.includes(s), `${file}: ${s}`);
      assert.ok(
        text.includes('stops syncing, turns off Auto Scan Daily and cancels this extension'),
        `${file}: Disconnect turns it off`,
      );
      assert.ok(text.includes('(Auto Scan Daily pauses with it)'), `${file}: the status file`);
      assert.doesNotMatch(text, /Daily Scan Reminder/, `${file}: no reminder left`);
      const alarms = bullets.find((b) => b.startsWith('alarms:'));
      assert.match(alarms || '', /^alarms: for store alerts and Auto Scan Daily only\./, file);
      const notes = bullets.find((b) => b.startsWith('notifications:'));
      assert.match(notes || '', /the Auto Scan Daily switch/, file);
    }
  }
  assert.ok(checked, 'Auto Scan Daily is on in the store build (src/flags.js)');
});

// The wishlist import (ui/scan/wishlist-import.js): a store or beta build with the
// `wishlistImport` flag on sends the wishlist this browser kept to the openhangar.space
// account. It fails here until both copies of the policy explain it in Optional Sync
// ("Your old wishlist, once", owner-approved words, word for word) and name it among the
// requests while connected, and the basic page never sends it in a build without the flag.
test('a store or beta build with the wishlist import on: the policy names it', async () => {
  const { buildValues, readRegistry } = await import('../scripts/build-flags.mjs');
  const { MAX_ITEMS } = await import('../ui/scan/wishlist-import.js');
  const registry = readRegistry(path.join(ROOT, 'src', 'flags.js'));
  // The policy's text, as plain words (no Markdown marks, no tags).
  const words = (f) =>
    plain(
      read(f)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
    );
  for (const [build, beta] of [
    ['store', false],
    ['beta', true],
  ]) {
    if (!buildValues(registry, { beta }).wishlistImport) continue;
    for (const file of ['docs/PRIVACY.md', 'site/privacy.html']) {
      const text = words(file);
      assert.match(
        text,
        new RegExp(`Your old wishlist, once: .*? up to ${MAX_ITEMS} items\\.`),
        `${file} explains the wishlist import (the ${build} build sends the wishlist)`,
      );
      assert.ok(
        text.includes('to send your old wishlist once'),
        `${file} names the wishlist import among the requests while connected`,
      );
    }
  }
  // The scan runner (every page's import, the basic page's too) asks the flag before
  // anything else, and no page sends it another way.
  const runner = read('ui/scan/runner.js');
  const fn = /async function wishlistToAccount\(\) \{\n\s*(.*)\n/.exec(runner);
  assert.ok(fn, 'ui/scan/runner.js has wishlistToAccount');
  assert.equal(fn[1], "if (!flag('wishlistImport')) return;");
  assert.match(runner, /const flag = \(name\) => OH\?\.flags\?\.\[name\] === true;/);
  assert.doesNotMatch(read('ui/basic/hub.svelte.js'), /importWishlist/);
});
