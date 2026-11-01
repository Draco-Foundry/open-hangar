'use strict';
// The sync payload's field list (docs/dev/sync-fields.md) against schema/sync-payload.schema.json.
// The privacy wording says what a sync can carry, so a new field fails here until someone
// updates the list and the owner has checked that wording. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'schema', 'sync-payload.schema.json'), 'utf8'),
);
const { validate } = require('../src/schema-check.js');
const LIST = path.join(ROOT, 'docs', 'dev', 'sync-fields.md');

const MESSAGE =
  'Sync fields changed. Update the field list and ask the owner to check the privacy wording before release.';

const OTHER_KEYS = '<other keys>';
const ANY_KEY = '<key>';

const resolve = (s) => {
  if (!s.$ref) return s;
  const name = s.$ref.replace('#/$defs/', '');
  assert.ok(SCHEMA.$defs[name], `unknown $ref ${s.$ref}`);
  return SCHEMA.$defs[name];
};

const strictness = (s) =>
  s.additionalProperties === false
    ? true
    : typeof s.additionalProperties === 'object'
      ? null
      : false;

// Every field the schema allows, depth first. `loc` is where it sits in a payload: keys,
// 0 for an array's items, 'k' for the key of a map. `strict` is true for an object that
// allows only the keys the schema names, false for one that allows others (its path then
// also gets a `.<other keys>` entry), and null for a map keyed by anything or a non-object.
function fields() {
  const out = [];
  const walk = (schema, p, loc, trail) => {
    const s = resolve(schema);
    if (schema.$ref) {
      assert.ok(!trail.includes(schema.$ref), `${schema.$ref} refers to itself`);
      trail = [...trail, schema.$ref];
    }
    const types = [].concat(s.type ?? []);
    const isObject = types.includes('object') || s.properties || s.additionalProperties;
    if (p) out.push({ path: p, loc, strict: isObject ? strictness(s) : null });
    if (isObject) {
      for (const [k, v] of Object.entries(s.properties ?? {})) {
        walk(v, p ? `${p}.${k}` : k, [...loc, k], trail);
      }
      if (typeof s.additionalProperties === 'object') {
        walk(s.additionalProperties, `${p}.${ANY_KEY}`, [...loc, 'k'], trail);
      } else if (s.additionalProperties !== false) {
        out.push({ path: `${p}.${OTHER_KEYS}`, loc: null, strict: null });
      }
    }
    if (types.includes('array') || s.items || s.prefixItems) {
      (s.prefixItems ?? []).forEach((v, i) => walk(v, `${p}[${i}]`, [...loc, i], trail));
      if (s.items) walk(s.items, `${p}[]`, [...loc, 0], trail);
    }
  };
  walk(SCHEMA, '', [], []);
  return out;
}

// The list's rows: | `path` | what it is | (Prettier pads the cells)
function listed() {
  const rows = new Map();
  for (const line of fs.readFileSync(LIST, 'utf8').split('\n')) {
    const m = /^\| `([^`]+)` +\| (.+?) +\|$/.exec(line);
    if (m) {
      assert.ok(!rows.has(m[1]), `${m[1]} is listed twice`);
      rows.set(m[1], m[2].trim());
    }
  }
  return rows;
}

test('the field list names every field the sync schema allows, and nothing else', () => {
  const found = fields().map((f) => f.path);
  const rows = listed();
  const added = found.filter((p) => !rows.has(p));
  const removed = [...rows.keys()].filter((p) => !found.includes(p));
  assert.ok(
    !added.length && !removed.length,
    `${MESSAGE}\nIn the schema, not in the list: ${added.join(', ') || 'none'}\n` +
      `In the list, not in the schema: ${removed.join(', ') || 'none'}`,
  );
  for (const [p, what] of rows) assert.ok(what.length >= 8, `${p}: say what it is`);
  assert.ok(found.length > 80, `${found.length} fields: the walk found the whole schema`);
});

// A payload that reaches every container in the schema, so a key can be tried at each.
const FULL = {
  app: 'open-hangar',
  appVersion: '0.5.6',
  exportedAt: '2026-10-31T12:00:00.000Z',
  schemaVersion: 2,
  account: {
    handle: 'TestPilot',
    displayName: 'Test Pilot',
    avatar: null,
    ueeRecord: '#000000',
    enlistedSince: 'Jan 1, 2950',
    country: 'Testland',
    organization: { name: 'Test Org', sid: 'TEST', rank: 'Member', logo: null },
    subscriber: { type: 'Centurion', frequency: 'monthly' },
    concierge: { level: 'Wing Commander', next: 'Praetorian', percent: 50 },
    balances: {
      storeCredit: { value: 100, currency: 'USD', symbol: '$', label: 'Store Credit' },
      uec: { value: 1, currency: 'UEC', symbol: 'UEC', label: 'UEC' },
      rec: { value: 1, currency: 'REC', symbol: 'REC', label: 'REC' },
    },
    capturedAt: 1,
  },
  sources: {
    hangar: {
      items: [
        {
          id: 1,
          name: 'Test Pledge',
          contents: [{ kind: 'Ship', label: 'Test Ship' }],
          ccu: { from: 'A', to: 'B' },
          raw: { a: 1 },
        },
      ],
      scannedAt: 1,
      meta: { shape: { n: 1 }, probe: { at: 1, n: 1, v: null } },
    },
    buybacks: {
      items: [
        {
          id: 2,
          name: 'Test Buy-back',
          contents: [{ kind: 'Ship', label: 'Test Ship' }],
          ccu: { from: 'A', to: 'B' },
        },
      ],
      scannedAt: 1,
      meta: { tokens: 1 },
    },
    referral: {
      items: {
        current: { recruits: 1 },
        legacy: { recruits: 1 },
        prospects: 1,
        recruitsList: [{ enlistedOn: 'a', convertedOn: 'b', campaign: 'current' }],
      },
      scannedAt: 1,
      meta: {},
    },
    orders: {
      items: [{ id: 'ORD-1', date: null, lines: [{ name: 'Test Item' }] }],
      scannedAt: 1,
      meta: { pages: 1, complete: true },
    },
    subStore: {
      items: [{ id: '1', name: 'Test Item', kind: 'subscriber', concierge: false }],
      scannedAt: 1,
      meta: { total: 1, complete: true },
    },
    pledgeLog: {
      items: [{ at: '2026-10-30T22:12:00Z', pledge: '1', kind: 'bought' }],
      scannedAt: 1,
      meta: { pages: 1, unread: 0 },
    },
    creditLog: {
      items: [{ at: '2026-10-30T22:12:00Z', dir: 'in', amount: 100, kind: 'melt' }],
      scannedAt: 1,
      meta: { pages: 1, unread: 0 },
    },
  },
  history: [{ at: 1, items: [[1, 'Test Pledge', 100]] }],
  pledgeArchive: {
    1: {
      id: '1',
      name: 'Test Pledge',
      ccu: { from: 'A', to: 'B' },
      contents: [{ kind: 'Ship', label: 'Test Ship' }],
    },
  },
};

const at = (root, loc) => loc.reduce((o, k) => (k === 'k' ? o[Object.keys(o)[0]] : o?.[k]), root);
const clone = () => JSON.parse(JSON.stringify(FULL));
// What a payment method, a card, an address or a gift's recipient might be called.
const FORBIDDEN = [
  'card',
  'paymentMethod',
  'billingAddress',
  'address',
  'giftRecipient',
  'recipient',
  'processor',
  'email',
  'recipientEmail',
];

test('the sample payload is valid and reaches every object in the schema', () => {
  assert.equal(validate(SCHEMA, FULL), null);
  for (const f of fields()) {
    if (f.strict === null) continue;
    const there = at(FULL, f.loc);
    assert.ok(there && typeof there === 'object', `${f.path}: add it to the sample payload`);
  }
});

test('an unknown key, a card, address or gift recipient is refused at every strict level', () => {
  const strict = fields().filter((f) => f.strict);
  assert.ok(strict.length >= 25, `${strict.length} strict objects`);
  for (const f of strict) {
    for (const key of ['unknownField', ...FORBIDDEN]) {
      const payload = clone();
      at(payload, f.loc)[key] = 'x';
      const got = validate(SCHEMA, payload);
      assert.ok(got, `${f.path}: ${key} was accepted. ${MESSAGE}`);
      assert.ok(got.path.endsWith(`/${key}`), `${f.path}: ${key} refused at ${got.path}`);
    }
  }
});

const OPEN = [
  'sources.hangar.items[]',
  'sources.hangar.items[].contents[]',
  'sources.hangar.items[].raw',
  'sources.buybacks.items[]',
  'sources.referral.items.current',
  'sources.referral.items.legacy',
  'sources.referral.items.recruitsList[]',
];

test('the objects that allow other keys are pinned, and none is order data', () => {
  const open = fields()
    .filter((f) => f.strict === false)
    .map((f) => f.path);
  assert.deepEqual(open, OPEN, `${MESSAGE} (an object started or stopped allowing other keys)`);
  for (const p of open) assert.doesNotMatch(p, /orders/, p);
});
