'use strict';
// Open Hangar Beta (docs/BETA.md, npm run build:beta): its version file and icons.
// The built package itself is checked by scripts/check-store-build.mjs --beta.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f));

test('beta version: four numbers for the stores, "0.3.0 Beta N" for people', () => {
  const b = JSON.parse(read('beta/beta.json'));
  const parts = b.version.split('.');
  assert.equal(parts.length, 4, 'Chrome and Edge take up to four dotted numbers');
  for (const p of parts) assert.ok(/^\d+$/.test(p) && +p <= 65535, `"${p}" in ${b.version}`);
  const m = /^(\d+\.\d+\.\d+) Beta (\d+)$/.exec(b.version_name);
  assert.ok(m, `version_name "${b.version_name}"`);
  assert.equal(`${m[1]}.${m[2]}`, b.version, 'Beta N is the fourth number');
});

test('beta icons: one for every size the manifest names, none of them the public one', () => {
  const manifest = JSON.parse(read('manifest.json'));
  for (const file of Object.values(manifest.icons)) {
    const beta = read(`beta/${file}`);
    assert.equal(beta.subarray(1, 4).toString(), 'PNG', `beta/${file} is a PNG`);
    assert.ok(!beta.equals(read(file)), `beta/${file} differs from ${file}`);
  }
});
