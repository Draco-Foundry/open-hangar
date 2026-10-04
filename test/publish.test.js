'use strict';
// The release pipeline's decisions (scripts/publish/lib.mjs) and the Discord post
// text, so a broken gate or announcement fails a PR instead of release day (#235).
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const lib = () => import('../scripts/publish/lib.mjs');

test('ciPassed: a green CI run on the commit lets it through', async () => {
  const { ciPassed } = await lib();
  assert.equal(ciPassed([{ status: 'completed', conclusion: 'success' }]), true);
  assert.equal(
    ciPassed([
      { status: 'completed', conclusion: 'failure' },
      { status: 'completed', conclusion: 'success' },
    ]),
    true,
  );
});

test('ciPassed: no run, a red run or a run still going blocks it', async () => {
  const { ciPassed } = await lib();
  assert.equal(ciPassed([]), false);
  assert.equal(ciPassed(null), false);
  assert.equal(ciPassed([{ status: 'completed', conclusion: 'failure' }]), false);
  assert.equal(ciPassed([{ status: 'in_progress', conclusion: '' }]), false);
});

test('tagMatches: v-prefixed or bare tag against manifest.json', async () => {
  const { tagMatches } = await lib();
  assert.equal(tagMatches('v0.2.13', '0.2.13'), true);
  assert.equal(tagMatches('0.2.13', '0.2.13'), true);
  assert.equal(tagMatches('v0.2.12', '0.2.13'), false);
  assert.equal(tagMatches('', '0.2.13'), false);
  assert.equal(tagMatches(undefined, '0.2.13'), false);
});

test('chromeOutcome: still-in-review is a wait, not a failure', async () => {
  const { chromeOutcome } = await lib();
  // Real output from Publish run #9 (0.2.13), 2026-10-01.
  const waiting = `Fetching token...
Uploading open-hangar-chrome-0.2.13.zip...
Error: ITEM_NOT_UPDATABLE
{
  kind: 'chromewebstore#item',
  uploadState: 'FAILURE',
  itemError: [ { error_code: 'ITEM_NOT_UPDATABLE' } ]
}`;
  assert.equal(chromeOutcome(waiting, 1), 'waiting');
  assert.equal(chromeOutcome('Fetching token...\nUploading...\nPublished', 0), 'ok');
  assert.equal(chromeOutcome('Error: Bad Request', 1), 'failed');
  assert.equal(chromeOutcome("uploadState: 'FAILURE'", 0), 'failed');
});

test('parseRunName: reads the tag, store and dry run back from a run name', async () => {
  const { parseRunName } = await lib();
  assert.deepEqual(parseRunName('Publish v0.2.13 to all'), {
    tag: 'v0.2.13',
    store: 'all',
    dry: false,
  });
  assert.deepEqual(parseRunName('Publish v0.2.13 to chrome (dry run)'), {
    tag: 'v0.2.13',
    store: 'chrome',
    dry: true,
  });
  assert.equal(parseRunName('Publish to stores'), null); // runs from before #183
  assert.equal(parseRunName(undefined), null);
});

test('dailyGate: one store update a day, unless it finishes the same release', async () => {
  const { dailyGate } = await lib();
  const ok = (name) => ({ name, conclusion: 'success', uploaded: false });
  const today = [ok('Publish v0.2.13 to all')];
  // Nothing earlier, or only dry runs and Discord posts: go.
  assert.equal(dailyGate({ runs: [], tag: 'v0.2.14', store: 'all' }), null);
  assert.equal(
    dailyGate({
      runs: [ok('Publish v0.2.13 to all (dry run)'), ok('Publish v0.2.13 to discord')],
      tag: 'v0.2.14',
      store: 'all',
    }),
    null,
  );
  // A second release the same day is held back...
  assert.match(dailyGate({ runs: today, tag: 'v0.2.14', store: 'all' }), /v0\.2\.13/);
  assert.ok(dailyGate({ runs: today, tag: 'v0.2.14', store: 'chrome' }));
  // ...and so is sending the same tag to every store again.
  assert.ok(dailyGate({ runs: today, tag: 'v0.2.13', store: 'all' }));
  // Finishing today's release one store at a time is fine, v-prefix or not.
  assert.equal(dailyGate({ runs: today, tag: 'v0.2.13', store: 'chrome' }), null);
  assert.equal(dailyGate({ runs: today, tag: '0.2.13', store: 'firefox' }), null);
  // Discord-only runs upload nothing, and the Hotfix box lets anything through.
  assert.equal(dailyGate({ runs: today, tag: 'v0.2.14', store: 'discord' }), null);
  assert.equal(dailyGate({ runs: today, tag: 'v0.2.14', store: 'all', allow: true }), null);
});

test('dailyGate: a failed run counts only if a store got the upload', async () => {
  const { dailyGate } = await lib();
  const failed = (uploaded) => [
    { name: 'Publish v0.2.13 to all', conclusion: 'failure', uploaded },
  ];
  assert.equal(dailyGate({ runs: failed(false), tag: 'v0.2.14', store: 'all' }), null);
  assert.ok(dailyGate({ runs: failed(true), tag: 'v0.2.14', store: 'all' }));
  assert.equal(dailyGate({ runs: failed(true), tag: 'v0.2.13', store: 'edge' }), null);
  // A run from before run names carried the tag: can't tell, so it counts.
  const old = [{ name: 'Publish to stores', conclusion: 'success', uploaded: false }];
  assert.match(dailyGate({ runs: old, tag: 'v0.2.13', store: 'chrome' }), /tag is unknown/);
});

const discord = () => import('../scripts/discord-post.mjs');
const changelog = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
const embedsOf = (messages) => messages.flatMap((m) => m.embeds);

// Discord's limits: 4096 per description, 6000 per message, 10 embeds per message.
const withinLimits = (messages) =>
  messages.every(
    (m) =>
      m.embeds.length <= 10 &&
      m.embeds.reduce((n, e) => n + (e.title || '').length + e.description.length, 0) <= 6000 &&
      m.embeds.every((e) => e.description.length <= 4096) &&
      m.allowed_mentions.parse.length === 0,
  );

test('Discord post: the whole release, grouped like the Updates page', async () => {
  const { buildMessages, releaseSection } = await discord();
  const messages = buildMessages(changelog, '0.2.13');
  const embeds = embedsOf(messages);
  assert.equal(embeds[0].title, 'Open Hangar 0.2.13 is on the way');
  const titles = embeds.map((e) => e.title).filter(Boolean);
  assert.deepEqual(titles.slice(1), ['Improved', 'Fixed']); // 0.2.13 has no New items
  const items = embeds.slice(1).flatMap((e) => e.description.split('\n'));
  assert.equal(items.length, releaseSection(changelog, '0.2.13').bullets.length);
  for (const it of items) {
    assert.match(it, /^• (\*\*)?[A-Z0-9"]/); // prefix gone, first letter capitalized
    assert.doesNotMatch(it, /^• (\*\*)?(New|Improved|Changed|Fixed):/);
  }
  assert.doesNotMatch(JSON.stringify(messages), /—/); // house style: no em dashes
  assert.ok(withinLimits(messages));
});

test('Discord post: a big release splits across embeds and messages, losing nothing', async () => {
  const { buildMessages } = await discord();
  const long = 'x'.repeat(380);
  const bullets = Array.from({ length: 60 }, (_, i) => `- Improved: **Item ${i}** ${long}`);
  const log = `## 9.9.9 — 2026-12-31\n\n${bullets.join('\n')}\n\n## 9.9.8 — 2026-12-30\n`;
  const messages = buildMessages(log, '9.9.9');
  assert.ok(messages.length > 1);
  assert.ok(withinLimits(messages));
  const text = embedsOf(messages)
    .map((e) => e.description)
    .join('\n');
  for (let i = 0; i < 60; i++) assert.ok(text.includes(`**Item ${i}**`), `item ${i} kept`);
  assert.equal(buildMessages(log, '1.0.0'), null);
});

test('updateCheckVersion: reads the version from a Chrome or Edge update check', async () => {
  const { updateCheckVersion } = await lib();
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><gupdate xmlns="http://www.google.com/update2/response" protocol="2.0"><app appid="x" status="ok"><updatecheck codebase="https://x/y.crx" fp="1.ab" hash_sha256="cd" status="ok" version="0.2.7"/></app></gupdate>';
  assert.equal(updateCheckVersion(xml), '0.2.7');
  assert.equal(updateCheckVersion('<updatecheck status="noupdate"/>'), null);
  assert.equal(updateCheckVersion(null), null);
});

test('edgeDetailsVersion: reads the version from Edge Add-ons product details', async () => {
  const { edgeDetailsVersion } = await lib();
  assert.equal(edgeDetailsVersion('{"name":"Open Hangar","version":"0.2.16"}'), '0.2.16');
  assert.equal(edgeDetailsVersion('{"version":"<b>1</b>"}'), null);
  assert.equal(edgeDetailsVersion('not json'), null);
  assert.equal(edgeDetailsVersion(null), null);
});

test('versionNewer compares numerically', async () => {
  const { versionNewer } = await lib();
  assert.equal(versionNewer('0.2.10', '0.2.9'), true);
  assert.equal(versionNewer('0.2.9', '0.2.10'), false);
  assert.equal(versionNewer('0.3.0', '0.3.0'), false);
  assert.equal(versionNewer('0.3', '0.2.99'), true);
  assert.equal(versionNewer('0.2.8', null), true);
  assert.equal(versionNewer(null, '0.2.8'), false);
});

test('submittedVersions: only real uploads count', async () => {
  const { submittedVersions } = await lib();
  const ok = (name) => ({ name, conclusion: 'success', notes: [] });
  const runs = [
    {
      title: 'Publish v0.2.8 to all',
      jobs: [ok('build'), ok('firefox'), ok('edge'), ok('chrome')],
    },
    {
      title: 'Publish v0.2.9 to all',
      jobs: [
        ok('firefox'),
        { name: 'edge', conclusion: 'failure', notes: [] },
        {
          name: 'chrome',
          conclusion: 'success',
          notes: [
            "Chrome is still reviewing the previous version, so it won't take a new one yet.",
          ],
        },
      ],
    },
    { title: 'Publish v0.3.0 to all (dry run)', jobs: [ok('firefox'), ok('edge'), ok('chrome')] },
    { title: 'Publish v0.2.9 to discord', jobs: [ok('discord')] },
  ];
  assert.deepEqual(submittedVersions(runs), { firefox: '0.2.9', edge: '0.2.8', chrome: '0.2.8' });
  assert.deepEqual(submittedVersions([]), {});
});

test('storeLine and stampStoreVersions fill the install buttons', async () => {
  const { storeLine, stampStoreVersions } = await lib();
  assert.deepEqual(storeLine('0.2.7', '0.2.8'), { live: '0.2.7', pending: '0.2.8' });
  assert.deepEqual(storeLine('0.2.8', '0.2.8'), { live: '0.2.8', pending: null });
  assert.deepEqual(storeLine(null, '0.2.8'), { live: null, pending: null });
  const page = fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8');
  for (const s of ['chrome', 'edge', 'firefox']) {
    assert.match(page, new RegExp(`<span class="b-ver" data-ver="${s}"></span\\s*>`), s);
    assert.match(page, new RegExp(`<span class="b-pend" data-pend="${s}"></span\\s*>`), s);
  }
  const out = stampStoreVersions(page, {
    chrome: { live: '0.2.7', pending: '0.2.8' },
    edge: { live: '0.2.8', pending: null },
    firefox: { live: null, pending: null },
  });
  assert.ok(out.includes('<span class="b-ver" data-ver="chrome">v0.2.7</span'));
  assert.ok(out.includes('<span class="b-pend" data-pend="chrome">v0.2.8 in review</span'));
  assert.ok(out.includes('<span class="b-ver" data-ver="edge">v0.2.8</span'));
  assert.ok(out.includes('<span class="b-pend" data-pend="edge"></span'));
  assert.ok(out.includes('<span class="b-ver" data-ver="firefox"></span'));
  // Stamping twice (a daily redeploy) gives the same page.
  assert.equal(stampStoreVersions(out, { chrome: { live: '0.2.7', pending: '0.2.8' } }), out);
});

test('versionsJson: one shape, blanks as null', async () => {
  const { versionsJson } = await lib();
  assert.deepEqual(
    versionsJson({
      version: '0.3.0',
      updated: '2026-11-10',
      lines: {
        chrome: { live: '0.3.0', pending: null },
        firefox: { live: '0.2.16', pending: '0.3.0' },
      },
      checkedAt: 'T',
    }),
    {
      version: '0.3.0',
      updated: '2026-11-10',
      stores: {
        chrome: { live: '0.3.0', pending: null },
        edge: { live: null, pending: null },
        firefox: { live: '0.2.16', pending: '0.3.0' },
      },
      checkedAt: 'T',
    },
  );
});
