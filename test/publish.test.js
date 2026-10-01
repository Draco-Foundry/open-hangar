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
