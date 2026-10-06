'use strict';
// Every chrome.storage.local key the extension's code writes, read from the source
// (src/*.js, ui/**/*.svelte|js): `storage.local.set({ … })` (and the Svelte pages'
// `store.set({ … })`) top-level keys, plus `mutateStored(KEY, …)`. A key built
// from a constant (`[STORE_KEY]`) is looked up as `const STORE_KEY = '…'`; one that
// can't be (`[key]`) is returned as written, in brackets. Used by
// test/storage-budget.test.js so a new key can't slip in without a cap.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function files() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|svelte)$/.test(e.name)) out.push(p);
    }
  };
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
    if (/\.js$/.test(f)) out.push(path.join(ROOT, 'src', f));
  }
  walk(path.join(ROOT, 'ui'));
  return out;
}

// The object literal starting at text[i] === '{' → its top-level entries (text).
function entries(text, i) {
  let depth = 0;
  let quote = null;
  let cur = '';
  const out = [];
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === '\\') cur += text[++i];
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      cur += c;
      continue;
    }
    if ('{[('.includes(c)) {
      depth++;
      if (depth === 1) continue;
    } else if ('}])'.includes(c)) {
      depth--;
      if (depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        return out;
      }
    } else if (c === ',' && depth === 1) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  return out;
}

function keyOf(entry, consts) {
  if (entry.startsWith('...')) {
    // `...(cond ? { a: 1 } : {})`: the keys inside the spread.
    return [...entry.matchAll(/\{\s*(\w+)\s*:/g)].map((m) => m[1]);
  }
  let m = /^\[\s*(\w+)(\([^)]*\))?\s*\]\s*:/.exec(entry);
  if (m) {
    if (m[2]) return [`[${m[1]}()]`];
    return [consts[m[1]] || `[${m[1]}]`];
  }
  m = /^['"]?([\w:-]+)['"]?\s*(:|$)/.exec(entry);
  return m ? [m[1]] : [];
}

function writtenKeys() {
  const keys = new Map(); // key → [files]
  const add = (k, f) => {
    const rel = path.relative(ROOT, f);
    if (!keys.has(k)) keys.set(k, new Set());
    keys.get(k).add(rel);
  };
  for (const f of files()) {
    // Line comments out (an apostrophe in one would read as a string); `https://`
    // stays, since a comment needs a space or a line start before it.
    const text = fs.readFileSync(f, 'utf8').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    const consts = {};
    for (const m of text.matchAll(/const (\w+) = '([^']+)'/g)) consts[m[1]] = m[2];
    for (const m of text.matchAll(/(?:storage\.local|\bstore)\.set\(\s*\{/g)) {
      const at = m.index + m[0].length - 1;
      for (const e of entries(text, at)) for (const k of keyOf(e, consts)) add(k, f);
    }
    for (const m of text.matchAll(/mutateStored\(\s*(\w+|'[^']+')\s*,/g)) {
      const raw = m[1];
      if (raw === 'key') continue; // the helper's own definition
      add(raw.startsWith("'") ? raw.slice(1, -1) : consts[raw] || `[${raw}]`, f);
    }
  }
  return keys;
}

module.exports = { writtenKeys };
