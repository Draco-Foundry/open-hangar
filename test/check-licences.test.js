'use strict';
// The no-GPL licence check (scripts/check-licences.mjs): permissive choices pass, the
// allow list is by name, today's lockfile passes. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lib = () => import('../scripts/check-licences.mjs');
const lock = (license, name = 'x') => ({
  packages: { '': {}, [`node_modules/${name}`]: { version: '1.0.0', license } },
});

test('GPL, LGPL and AGPL fail; a permissive choice passes', async () => {
  const { permissive } = await lib();
  for (const l of ['GPL-3.0', 'LGPL-3.0-or-later', 'AGPL-3.0-only', 'Apache-2.0 AND LGPL-3.0'])
    assert.equal(permissive(l), false, l);
  for (const l of ['MIT', 'MPL-2.0', '(MIT OR GPL-3.0-or-later)', '(BSD-3-Clause OR GPL-2.0)'])
    assert.equal(permissive(l), true, l);
});

test('a copyleft package fails unless allowed by name', async () => {
  const { problems } = await lib();
  assert.deepEqual(problems('f', lock('GPL-3.0')), ['f: x@1.0.0 is GPL-3.0']);
  assert.deepEqual(problems('f', lock({ type: 'AGPL-3.0' })), ['f: x@1.0.0 is AGPL-3.0']);
  assert.deepEqual(
    problems('f', lock('LGPL-3.0', '@a/b-1'), [['@a/b-*', 'why', '2099-01-01']]),
    [],
  );
});

test("today's lockfile passes", async () => {
  const { LOCKFILES, problems } = await lib();
  for (const f of LOCKFILES) {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
    assert.deepEqual(problems(f, json), []);
  }
});
