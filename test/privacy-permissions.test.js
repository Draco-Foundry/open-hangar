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
      const own = new RegExp(`(^|[^\\w.-])${host.replace(/\./g, '\\.')}(?![\\w-]|\\.\\w)`);
      for (const [file, text] of copies)
        assert.ok(own.test(text || ''), `${file} names ${host} (the ${build} build lets it in)`);
    }
  }
});

test('both copies of the policy explain permissions in the same words', () => {
  assert.deepEqual(htmlBullets(), mdBullets());
});
