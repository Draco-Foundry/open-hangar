'use strict';
// The privacy policy as plain text for store forms (docs/store-assets/privacy-plain.txt)
// is docs/PRIVACY.md with only the Markdown taken out, made by scripts/privacy-plain.mjs:
// the same words in the same order, none added. Run: `npm test` (`npm run privacy:plain`
// after changing the policy).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const lib = () => import('../scripts/privacy-plain.mjs');

test('privacy-plain.txt is the policy as plain text, regenerated', async () => {
  const { plainPolicy, POLICY_FILE, PLAIN_FILE } = await lib();
  const want = plainPolicy(read(POLICY_FILE)).split('\n');
  const have = read(PLAIN_FILE).split('\n');
  const at = want.findIndex((line, i) => line !== have[i]);
  const line = at === -1 && have.length !== want.length ? want.length : at + 1;
  assert.ok(
    at === -1 && have.length === want.length,
    `${PLAIN_FILE} differs from ${POLICY_FILE} (first at line ${line}). ` +
      'Run `npm run privacy:plain` and commit the result.',
  );
});

test('the plain text has every word of the policy, in order, and no new ones', async () => {
  const { POLICY_FILE, PLAIN_FILE } = await lib();
  // A link's address isn't in the plain text when it points to a section of the policy
  // or is the link's own text.
  const md = read(POLICY_FILE).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) =>
    url.startsWith('#') || url.replace(/^mailto:/, '') === text ? text : m,
  );
  const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  assert.deepEqual(words(read(PLAIN_FILE)), words(md));
  assert.doesNotMatch(read(PLAIN_FILE), /\*\*|`|\]\(|^#/m, 'no Markdown left');
});

test('only Markdown goes: headings, emphasis, code and link syntax', async () => {
  const { plainPolicy } = await lib();
  const md = [
    '# Privacy Policy: Test',
    '',
    '## Who *we* are',
    '',
    '**Bold**, _italic_, `code_name` and a snake_case word.',
    '- See [Who we are](#who-we-are), [our site](https://example.com/a_b) or',
    '  * [https://example.com](https://example.com), email [x@example.com](mailto:x@example.com)',
    '  or [us](mailto:x@example.com), or <https://example.com/c>.',
    '1. Numbered stays. #channel stays.',
  ].join('\n');
  assert.equal(
    plainPolicy(md),
    [
      'Privacy Policy: Test',
      '',
      'WHO WE ARE',
      '',
      'Bold, italic, code_name and a snake_case word.',
      '- See Who we are, our site (https://example.com/a_b) or',
      '  - https://example.com, email x@example.com',
      '  or us (x@example.com), or https://example.com/c.',
      '1. Numbered stays. #channel stays.',
      '',
    ].join('\n'),
  );
});

test('Markdown with no plain-text rule fails loudly', async () => {
  const { plainPolicy } = await lib();
  for (const md of [
    '| a | b |',
    '> quote',
    '<br>',
    '![img](a.png)',
    '---',
    'a \\* b',
    '**a [b](c)**',
  ])
    assert.throws(() => plainPolicy(`Intro\n\n${md}\n`), /PRIVACY\.md:3/, md);
});

test('privacy-amo.md is the policy for AMO: same words, no headings, regenerated', async () => {
  const { amoPolicy, POLICY_FILE, AMO_FILE } = await lib();
  const md = read(POLICY_FILE);
  assert.equal(
    read(AMO_FILE),
    amoPolicy(md),
    `${AMO_FILE} differs from ${POLICY_FILE}. Run \`npm run privacy:plain\` and commit the result.`,
  );
  // The words are the policy's, minus the title and the section addresses of links.
  const body = md
    .split('\n')
    .filter((l) => !/^# /.test(l))
    .join('\n')
    .replace(/\]\(#[^)\s]*\)/g, ']')
    .replace(/^## /gm, '');
  const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  assert.deepEqual(words(read(AMO_FILE)), words(body));
  assert.doesNotMatch(read(AMO_FILE), /^#|\]\(#/m, 'no headings, no section links');
});

test('AMO copy: no title, headings as bold lines, section links as text', async () => {
  const { amoPolicy } = await lib();
  const md = [
    '# Privacy Policy: Test',
    '',
    '**Last updated: 2026-10-14**',
    '',
    '## Who we are',
    '',
    '- See [Who we are](#who-we-are) and [our site](https://example.com/a_b).',
    '',
  ].join('\n');
  assert.equal(
    amoPolicy(md),
    [
      '**Last updated: 2026-10-14**',
      '',
      '**Who we are**',
      '',
      '- See Who we are and [our site](https://example.com/a_b).',
      '',
    ].join('\n'),
  );
  assert.throws(() => amoPolicy('x\n\n## A *b*\n'), /PRIVACY\.md:3/);
});
