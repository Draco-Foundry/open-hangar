/*
 * schema-check.js — checks a value against a JSON Schema, for the sync payload (#441).
 * ---------------------------------------------------------------------------
 * A small interpreter for the part of JSON Schema (2020-12) that
 * schema/sync-payload.schema.json uses, and nothing more: no dependencies, no eval
 * and no generated code. A schema that uses any other keyword is refused with an
 * error before anything is checked, so the schema can't quietly lean on one this
 * file ignores. The website checks syncs with its own copy of these rules; both give
 * the same path for the same payload (test/fixtures/sync-schema/).
 *
 * Loaded by the dashboard (before lib.js), the background worker (importScripts) and
 * Firefox's event page (its manifest's background.scripts, scripts/pack.mjs), and
 * required by node tests. Exposes self.OHSchema:
 *
 *   OHSchema.validate(schema, value) → null when it fits, else the first problem:
 *     { path, reason }   path: a JSON Pointer to the value ('' is the whole value; a
 *                        missing key's path is where it should be), reason: a few
 *                        words that never quote the value itself.
 *
 * Keywords: $schema, $id, $comment, title, description (notes only), $defs and $ref
 * ("#/$defs/<name>"), type, const, enum, minLength, maxLength, pattern, minimum,
 * maximum, prefixItems, items, minItems, maxItems, required, properties and
 * additionalProperties. `true` and `false` work as schemas. Numbers are finite (JSON
 * has no NaN), and a string's length counts characters, not UTF-16 units.
 *
 * Order, so every copy reports the same first problem: $ref, type, const, enum, the
 * string, number, array and object keywords. An array: its length, then each item in
 * order. An object: `required` in the schema's order, then each key in the value's
 * order (`properties`, else `additionalProperties`).
 */
(function (root) {
  const NOTES = ['$schema', '$id', '$comment', 'title', 'description'];
  const KEYWORDS = new Set([
    ...NOTES,
    '$defs',
    '$ref',
    'type',
    'const',
    'enum',
    'minLength',
    'maxLength',
    'pattern',
    'minimum',
    'maximum',
    'prefixItems',
    'items',
    'minItems',
    'maxItems',
    'required',
    'properties',
    'additionalProperties',
  ]);
  const TYPES = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
  const REF = /^#\/\$defs\/([^/~]+)$/;

  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const isCount = (n) => Number.isInteger(n) && n >= 0;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // The JSON type of a value, or '' when it isn't JSON (undefined, NaN, a function…).
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    switch (typeof v) {
      case 'string':
        return 'string';
      case 'boolean':
        return 'boolean';
      case 'number':
        return Number.isFinite(v) ? 'number' : '';
      case 'object':
        return 'object';
      default:
        return '';
    }
  }
  const fits = (want, v, t) => want === t || (want === 'integer' && Number.isInteger(v));

  // Characters, not UTF-16 units: a pair of surrogates is one.
  function charCount(s) {
    let n = s.length;
    for (let i = 0; i < s.length - 1; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        const d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) {
          n--;
          i++;
        }
      }
    }
    return n;
  }

  function same(a, b) {
    if (a === b) return true;
    const ta = typeOf(a);
    if (ta !== typeOf(b) || (ta !== 'array' && ta !== 'object')) return false;
    if (ta === 'array') return a.length === b.length && a.every((x, i) => same(x, b[i]));
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => has(b, k) && same(a[k], b[k]));
  }

  // Every schema is read once, in full, before it checks anything: an unknown keyword
  // or a malformed one throws here, wherever it sits.
  const ready = new WeakMap(); // root schema → { refs, patterns }
  function prepare(rootSchema) {
    if (!isObj(rootSchema)) throw new Error('sync schema: the top must be an object');
    const done = ready.get(rootSchema);
    if (done) return done;
    const patterns = new Map(); // pattern → RegExp
    const refs = new Map(); // "#/$defs/<name>" → that schema
    const defs = isObj(rootSchema.$defs) ? rootSchema.$defs : {};
    const bad = (at, why) => {
      throw new Error(`sync schema: ${why} at ${at || '#'}`);
    };
    const walk = (s, at) => {
      if (s === true || s === false) return;
      if (!isObj(s)) bad(at, 'a schema must be an object or true/false');
      for (const k of Object.keys(s)) if (!KEYWORDS.has(k)) bad(at, `unsupported keyword "${k}"`);
      if (has(s, '$defs')) {
        if (s !== rootSchema) bad(at, '$defs only at the top');
        if (!isObj(s.$defs)) bad(at, '$defs must be an object');
        for (const [k, d] of Object.entries(s.$defs)) walk(d, `${at}/$defs/${k}`);
      }
      if (has(s, '$ref')) {
        const m = REF.exec(s.$ref);
        if (!m || !has(defs, m[1])) bad(at, `unknown $ref "${s.$ref}"`);
        refs.set(s.$ref, defs[m[1]]);
      }
      if (has(s, 'type')) {
        const list = Array.isArray(s.type) ? s.type : [s.type];
        if (!list.length || !list.every((t) => TYPES.has(t))) bad(at, 'bad type');
      }
      if (has(s, 'enum') && (!Array.isArray(s.enum) || !s.enum.length)) bad(at, 'bad enum');
      for (const k of ['minLength', 'maxLength', 'minItems', 'maxItems'])
        if (has(s, k) && !isCount(s[k])) bad(at, `bad ${k}`);
      for (const k of ['minimum', 'maximum'])
        if (has(s, k) && typeOf(s[k]) !== 'number') bad(at, `bad ${k}`);
      if (has(s, 'pattern')) {
        if (typeof s.pattern !== 'string') bad(at, 'bad pattern');
        try {
          patterns.set(s.pattern, new RegExp(s.pattern, 'u'));
        } catch {
          bad(at, 'bad pattern');
        }
      }
      if (
        has(s, 'required') &&
        !(Array.isArray(s.required) && s.required.every((k) => typeof k === 'string'))
      )
        bad(at, 'bad required');
      if (has(s, 'properties')) {
        if (!isObj(s.properties)) bad(at, 'bad properties');
        for (const [k, p] of Object.entries(s.properties)) walk(p, `${at}/properties/${k}`);
      }
      if (has(s, 'additionalProperties'))
        walk(s.additionalProperties, `${at}/additionalProperties`);
      if (has(s, 'items')) walk(s.items, `${at}/items`);
      if (has(s, 'prefixItems')) {
        if (!Array.isArray(s.prefixItems)) bad(at, 'bad prefixItems');
        s.prefixItems.forEach((p, i) => walk(p, `${at}/prefixItems/${i}`));
      }
    };
    walk(rootSchema, '');
    const out = { refs, patterns };
    ready.set(rootSchema, out);
    return out;
  }

  const pointer = (path) =>
    path.map((k) => '/' + String(k).replace(/~/g, '~0').replace(/\//g, '~1')).join('');

  function validate(rootSchema, value) {
    const { refs, patterns } = prepare(rootSchema);
    const path = []; // where we are; joined into a pointer only for a problem
    let found = null;
    const fail = (reason, key) => {
      if (key !== undefined) path.push(key);
      found = { path: pointer(path), reason };
      return false;
    };

    // true when `v` fits `s`; else `found` says why.
    const check = (s, v) => {
      if (s === true) return true;
      if (s === false) return fail('not allowed here');
      if (s.$ref !== undefined && !check(refs.get(s.$ref), v)) return false;
      const t = typeOf(v);
      if (!t) return fail('not JSON');
      if (s.type !== undefined) {
        const want = Array.isArray(s.type) ? s.type : [s.type];
        if (!want.some((w) => fits(w, v, t))) return fail(`expected ${want.join(' or ')}`);
      }
      if (has(s, 'const') && !same(v, s.const)) return fail('not the expected value');
      if (s.enum !== undefined && !s.enum.some((e) => same(v, e)))
        return fail('not one of the allowed values');
      if (t === 'string') {
        if (s.minLength !== undefined && charCount(v) < s.minLength) return fail('too short');
        if (s.maxLength !== undefined && charCount(v) > s.maxLength) return fail('too long');
        if (s.pattern !== undefined && !patterns.get(s.pattern).test(v))
          return fail('does not match its pattern');
      } else if (t === 'number') {
        if (s.minimum !== undefined && v < s.minimum) return fail('below the minimum');
        if (s.maximum !== undefined && v > s.maximum) return fail('above the maximum');
      } else if (t === 'array') {
        if (s.minItems !== undefined && v.length < s.minItems) return fail('too few items');
        if (s.maxItems !== undefined && v.length > s.maxItems) return fail('too many items');
        const pre = s.prefixItems || [];
        for (let i = 0; i < v.length; i++) {
          const sub = i < pre.length ? pre[i] : s.items;
          if (sub === undefined) continue;
          path.push(i);
          if (!check(sub, v[i])) return false;
          path.pop();
        }
      } else if (t === 'object') {
        if (s.required) for (const k of s.required) if (!has(v, k)) return fail('missing', k);
        const props = s.properties || {};
        for (const k of Object.keys(v)) {
          const sub = has(props, k) ? props[k] : s.additionalProperties;
          if (sub === undefined) continue;
          if (sub === false) return fail('not allowed here', k);
          path.push(k);
          if (!check(sub, v[k])) return false;
          path.pop();
        }
      }
      return true;
    };

    return check(rootSchema, value) ? null : found;
  }

  const api = { validate, prepare, pointer, KEYWORDS: [...KEYWORDS] };
  root.OHSchema = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
