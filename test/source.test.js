// Guard: no stray control characters in shipped source. A mangled "\b" once
// became a literal backspace inside a regex, which silently never matched.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(js|html|json)$/.test(p) ? [p] : [];
  });
}

test('source files contain no control characters (other than tab/newline/CR)', () => {
  const bad = [];
  for (const p of [...files('src'), ...files('_locales'), 'manifest.json']) {
    const lines = readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(line)) bad.push(`${p}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
