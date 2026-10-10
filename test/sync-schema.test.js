'use strict';
// The sync payload's schema (#441): schema/sync-payload.schema.json, its copy for the
// extension's scripts (src/sync-schema.js), the checker (src/schema-check.js) and the
// conformance vectors in test/fixtures/sync-schema/ that the website's own checker
// runs too. Run: `npm test` (`npm run schema` after changing the JSON file).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const JSON_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'schema', 'sync-payload.schema.json'), 'utf8'),
);
const { validate, prepare, pointer } = require('../src/schema-check.js');
const SCHEMA = require('../src/sync-schema.js');
const SHAPE = require('../src/hangar-shape.js');
const { states } = require('./stored-data.js');

const VECTOR_DIR = path.join(ROOT, 'test', 'fixtures', 'sync-schema');
const vectors = fs
  .readdirSync(VECTOR_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(VECTOR_DIR, f), 'utf8')) }));

test('the scripts carry the schema file as it is, frozen', async () => {
  assert.deepEqual(SCHEMA, JSON_SCHEMA, 'run `npm run schema`');
  const { schemaScript } = await import('../scripts/sync-schema.mjs');
  assert.equal(
    fs.readFileSync(path.join(ROOT, 'src', 'sync-schema.js'), 'utf8'),
    await schemaScript(JSON_SCHEMA),
    'src/sync-schema.js is what `npm run schema` writes',
  );
  assert.ok(Object.isFrozen(SCHEMA) && Object.isFrozen(SCHEMA.$defs.pledge.properties));
});

test('the schema: format 2, only keywords the checker knows, strict where the extension builds', () => {
  assert.equal(SCHEMA.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.match(SCHEMA.$id, /\/2$/, 'its $id ends in the format version');
  assert.equal(SCHEMA.properties.schemaVersion.const, SHAPE.EXPORT_VERSION);
  assert.doesNotThrow(() => prepare(SCHEMA));
  const strict = (s) => s.additionalProperties === false;
  assert.ok(strict(SCHEMA), 'top level');
  assert.ok(strict(SCHEMA.$defs.account), 'account');
  assert.ok(strict(SCHEMA.$defs.account.properties.balances), 'account.balances');
  assert.ok(strict(SCHEMA.$defs.sources), 'sources');
  assert.ok(strict(SCHEMA.$defs.referral), 'the referral block');
  for (const id of ['pledge', 'buyback', 'content', 'recruit'])
    assert.ok(!strict(SCHEMA.$defs[id]), `${id} rows may gain keys`);
  // No address of the sync site: a build without sync carries the schema too.
  assert.doesNotMatch(JSON.stringify(SCHEMA), /app\.openhangar\.space/);
});

test('conformance vectors: each one gives its result and path', () => {
  assert.ok(vectors.length >= 30, `${vectors.length} vectors`);
  const names = new Set();
  for (const v of vectors) {
    assert.equal(typeof v.name, 'string', v.file);
    assert.ok(!names.has(v.name), `${v.file}: a name of its own`);
    names.add(v.name);
    assert.deepEqual(
      Object.keys(v)
        .filter((k) => k !== 'file')
        .sort(),
      v.valid ? ['name', 'payload', 'valid'] : ['name', 'path', 'payload', 'valid'],
      v.file,
    );
    const got = validate(SCHEMA, v.payload);
    if (v.valid) assert.equal(got, null, `${v.file}: ${JSON.stringify(got)}`);
    else {
      assert.ok(got, `${v.file} should fail`);
      assert.equal(got.path, v.path, `${v.file}: ${got.reason}`);
    }
  }
  assert.ok(
    vectors.some((v) => v.valid && !('history' in v.payload)),
    'a hangar view',
  );
  assert.ok(vectors.filter((v) => !v.valid).length >= 25, 'each kind of failure');
});

test('vectors hold invented data only: no real players, no real referral codes', () => {
  for (const v of vectors) {
    const text = JSON.stringify(v.payload);
    for (const handle of text.matchAll(/"handle":"([^"]*)"/g))
      assert.match(handle[1], /^(TestPilot|Recruit\d+)$/, v.file);
    for (const code of text.matchAll(/STAR-[A-Z0-9]{4}-[A-Z0-9]{4}/g))
      assert.equal(code[0], 'STAR-TEST-0000', v.file);
  }
});

test('what the extension really sends fits: every stored state, synced and as a hangar view', () => {
  for (const { name, mem } of states()) {
    const db = SHAPE.checkDB(mem.db ?? { schemaVersion: 3, sources: {} }).db;
    const backup = SHAPE.exportPayload({
      db,
      account: mem.account,
      archive: mem.pledgeArchive,
      appVersion: '0.3.0',
    });
    const sync = JSON.parse(JSON.stringify(SHAPE.withoutProspects(backup)));
    assert.equal(validate(SCHEMA, sync), null, `${name}: sync`);
    assert.equal(SHAPE.checkPayload(sync), null, `${name}: sync`);
    assert.equal(SHAPE.checkHangarView(SHAPE.hangarView(sync)), null, `${name}: view`);
    // The backup file keeps the prospects, so it isn't a sync payload.
    if (backup.sources.referral?.items?.prospectsList)
      assert.equal(validate(SCHEMA, backup).path, '/sources/referral/items/prospectsList');
  }
});

// The checker on its own, with small schemas.
test('checker: types, nulls and values that are not JSON', () => {
  const s = { type: ['string', 'null'] };
  assert.equal(validate(s, 'x'), null);
  assert.equal(validate(s, null), null);
  assert.deepEqual(validate(s, 1), { path: '', reason: 'expected string or null' });
  assert.equal(validate({ type: 'integer' }, 2), null);
  assert.equal(validate({ type: 'integer' }, 2.5).reason, 'expected integer');
  assert.equal(validate({ type: 'number' }, 2), null);
  for (const v of [NaN, Infinity, undefined, () => 1, 10n])
    assert.equal(validate({}, v)?.reason, 'not JSON', String(v));
  assert.equal(validate({ type: 'object' }, []).reason, 'expected object');
  assert.equal(validate({ type: 'array' }, {}).reason, 'expected array');
  // true and false work as schemas inside one.
  assert.equal(validate({ properties: { a: true } }, { a: [1] }), null);
  assert.equal(validate({ properties: { a: false } }, { a: 1 }).reason, 'not allowed here');
});

test('checker: const, enum, strings and numbers', () => {
  assert.equal(validate({ const: { a: [1, 2] } }, { a: [1, 2] }), null);
  assert.equal(validate({ const: { a: [1, 2] } }, { a: [2, 1] }).reason, 'not the expected value');
  assert.equal(validate({ enum: ['a', 2, null] }, null), null);
  assert.equal(validate({ enum: ['a', 2, null] }, '2').reason, 'not one of the allowed values');
  const str = { type: 'string', minLength: 2, maxLength: 3, pattern: '^a' };
  assert.equal(validate(str, 'ab'), null);
  assert.equal(validate(str, 'a').reason, 'too short');
  assert.equal(validate(str, 'abcd').reason, 'too long');
  assert.equal(validate(str, 'ba').reason, 'does not match its pattern');
  // Characters, not UTF-16 units: one rocket is one.
  assert.equal(validate({ maxLength: 1 }, '\u{1F680}'), null);
  assert.equal(validate({ minLength: 2 }, '\u{1F680}').reason, 'too short');
  // A pattern isn't anchored unless it says so, and the u flag is on.
  assert.equal(validate({ pattern: 'b' }, 'abc'), null);
  assert.equal(validate({ pattern: '^\\p{Lu}' }, 'Abc'), null);
  const num = { type: 'number', minimum: 0, maximum: 10 };
  assert.equal(validate(num, 0), null);
  assert.equal(validate(num, 10), null);
  assert.equal(validate(num, -1).reason, 'below the minimum');
  assert.equal(validate(num, 11).reason, 'above the maximum');
  // String and number keywords only look at their own type.
  assert.equal(validate({ minLength: 5, minimum: 5 }, true), null);
});

test('checker: arrays, objects and paths', () => {
  const tuple = { type: 'array', minItems: 2, maxItems: 3, prefixItems: [{ type: 'string' }] };
  assert.equal(validate({ ...tuple, items: { type: 'number' } }, ['a', 1, 2]), null);
  assert.deepEqual(validate({ ...tuple, items: { type: 'number' } }, ['a', 'b']), {
    path: '/1',
    reason: 'expected number',
  });
  assert.equal(validate(tuple, [1, 2]).path, '/0');
  assert.equal(validate(tuple, ['a']).reason, 'too few items');
  assert.equal(validate(tuple, ['a', 1, 2, 3]).reason, 'too many items');
  const obj = {
    type: 'object',
    required: ['a', 'b'],
    properties: { a: { type: 'string' }, b: { type: 'number' } },
    additionalProperties: { type: 'boolean' },
  };
  assert.equal(validate(obj, { a: 'x', b: 1, c: true }), null);
  assert.deepEqual(validate(obj, { a: 'x' }), { path: '/b', reason: 'missing' });
  assert.deepEqual(validate(obj, { a: 'x', b: 1, c: 1 }), {
    path: '/c',
    reason: 'expected boolean',
  });
  // required comes first, in the schema's order; then the value's keys in its order.
  assert.equal(validate(obj, { c: 1 }).path, '/a');
  assert.equal(validate(obj, { b: 'x', a: 1 }).path, '/b');
  // JSON Pointer escapes: ~ is ~0 and / is ~1.
  const closed = { type: 'object', additionalProperties: false };
  assert.equal(validate({ properties: { x: closed } }, { x: { 'a/b~c': 1 } }).path, '/x/a~1b~0c');
  assert.equal(pointer(['a/b', '~', 0]), '/a~1b/~0/0');
});

test('checker: $ref into $defs, nested', () => {
  const s = {
    $defs: { n: { type: 'number' }, list: { type: 'array', items: { $ref: '#/$defs/n' } } },
    type: 'object',
    properties: { xs: { $ref: '#/$defs/list' } },
  };
  assert.equal(validate(s, { xs: [1, 2] }), null);
  assert.deepEqual(validate(s, { xs: [1, 'x'] }), { path: '/xs/1', reason: 'expected number' });
});

test('checker: a keyword it does not know is refused, wherever it sits', () => {
  assert.throws(
    () => validate({ oneOf: [{ type: 'string' }] }, 'x'),
    /unsupported keyword "oneOf"/,
  );
  assert.throws(() => validate({ type: 'string', format: 'date-time' }, 'x'), /"format"/);
  // Even in a branch this value never reaches, and in an unused definition.
  assert.throws(
    () => validate({ properties: { a: { anyOf: [] } } }, {}),
    /unsupported keyword "anyOf" at \/properties\/a/,
  );
  assert.throws(() => validate({ $defs: { x: { not: {} } } }, 1), /"not"/);
  assert.throws(() => validate({ $ref: '#/$defs/missing' }, 1), /unknown \$ref/);
  assert.throws(() => validate({ $ref: 'https://example.invalid/s' }, 1), /unknown \$ref/);
  assert.throws(() => validate({ type: 'date' }, 1), /bad type/);
  assert.throws(() => validate({ pattern: '(' }, 'x'), /bad pattern/);
  assert.throws(() => validate({ required: 'a' }, {}), /bad required/);
  assert.throws(() => validate({ properties: { a: { $defs: {} } } }, {}), /\$defs only at the top/);
  assert.throws(() => validate(true, 1), /the top must be an object/);
  // Every keyword the schema file uses is one the checker knows.
  const used = new Set();
  const walk = (s) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return;
    for (const [k, v] of Object.entries(s)) {
      used.add(k);
      if (k === 'properties' || k === '$defs') Object.values(v).forEach(walk);
      else if (k === 'prefixItems') v.forEach(walk);
      else if (k === 'items' || k === 'additionalProperties') walk(v);
    }
  };
  walk(JSON_SCHEMA);
  const { KEYWORDS } = require('../src/schema-check.js');
  for (const k of used) assert.ok(KEYWORDS.includes(k), k);
});

test('checker: a payload as big as sync allows is checked in good time', () => {
  const { pledge, snapshot } = require('./stored-data.js');
  const sync = JSON.parse(
    JSON.stringify(
      SHAPE.withoutProspects(
        SHAPE.exportPayload({
          db: {
            schemaVersion: 3,
            sources: {
              hangar: { items: Array.from({ length: 1500 }, (_, i) => pledge(i)), scannedAt: 1 },
            },
            history: Array.from({ length: 30 }, (_, i) => snapshot(1e12 + i, 1500)),
          },
        }),
      ),
    ),
  );
  const t = Date.now();
  assert.equal(SHAPE.checkPayload(sync), null);
  assert.ok(Date.now() - t < 2000, `${Date.now() - t} ms`);
});
