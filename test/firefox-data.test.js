'use strict';
// Firefox's data-collection declaration for sync (scripts/pack.mjs) and the runtime
// request in the dashboard (src/dashboard.js) must name the same categories, and
// only ones Firefox knows. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const list = (src, re) => {
  const m = re.exec(src);
  assert.ok(m, `found ${re}`);
  return [...m[1].matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1]);
};
// Firefox's optional data-collection categories (addons-linter's manifest schema).
const KNOWN = [
  'authenticationInfo',
  'bookmarksInfo',
  'browsingActivity',
  'financialAndPaymentInfo',
  'healthInfo',
  'locationInfo',
  'personalCommunications',
  'personallyIdentifyingInfo',
  'searchTerms',
  'websiteActivity',
  'websiteContent',
];

test('sync declares and requests the same Firefox data categories', () => {
  const pack = list(read('scripts/pack.mjs'), /const SYNC_DATA = \[([^\]]+)\]/);
  const dash = list(read('src/dashboard.js'), /data_collection: \[([^\]]+)\]/);
  assert.deepEqual(dash, pack);
  // The beta's store check holds the Firefox beta to the same list.
  assert.deepEqual(
    list(read('scripts/check-store-build.mjs'), /const SYNC_DATA = \[([^\]]+)\]/),
    pack,
  );
  for (const c of pack) assert.ok(KNOWN.includes(c), `${c} is a Firefox category`);
});

test('store builds still declare that nothing is collected', () => {
  assert.match(read('scripts/pack.mjs'), /: \{ required: \['none'\] \}/);
});
