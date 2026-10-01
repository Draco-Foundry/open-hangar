'use strict';
// The release pipeline's decisions (scripts/publish/lib.mjs) and the Discord post
// text, so a broken gate or announcement fails a PR instead of release day (#235).
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

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

const post = (version) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [path.join(__dirname, '../scripts/discord-post.mjs'), version, '--dry-run'],
      {
        encoding: 'utf8',
      },
    ),
  ).embeds[0].description;

test('Discord post: a release with "New" items leads with them', () => {
  const text = post('0.2.12');
  assert.match(text, /^• /);
  assert.doesNotMatch(text, /—/); // house style: no em dashes in public posts
});

test('Discord post: a fixes-only release still lists highlights', () => {
  const text = post('0.2.13');
  assert.match(text, /^• /);
  assert.doesNotMatch(text, /Fixes and polish all over/);
  assert.doesNotMatch(text, /—/);
});
