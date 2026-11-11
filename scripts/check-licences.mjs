#!/usr/bin/env node
// No GPL, LGPL or AGPL packages (our licence is PolyForm Strict). Reads the lockfile's own
// `license` fields, so it needs no install and takes about a second. A package that also
// offers a permissive licence ("MIT OR GPL-3.0", as jszip and node-forge do through
// web-ext) passes: we take it under the permissive one. Anything else copyleft fails
// unless it's on ALLOWED below, each with its reason and a date to look at it again.
//
// Run by CI (.github/workflows/ci.yml): node scripts/check-licences.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCKFILES = ['package-lock.json'];

// Allowed by name (a trailing * matches a prefix): [pattern, reason, review by]. None today.
export const ALLOWED = [];

const COPYLEFT = /\b(A|L)?GPL\b/i;

// One SPDX expression → true when we can use it without a GPL-family licence: every
// AND part must have at least one OR choice that isn't GPL-family. Parentheses are
// dropped, so "(MIT OR GPL-3.0) AND BSD" reads as MIT OR GPL-3.0, AND BSD: fine for the
// expressions npm packages use.
export function permissive(expr) {
  return String(expr)
    .replace(/[()]/g, ' ')
    .split(/\s+AND\s+/i)
    .every((part) => part.split(/\s+OR\s+/i).some((choice) => !COPYLEFT.test(choice)));
}

const allowedBy = (name, allowed) =>
  allowed.find(([p]) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));

// A lockfile's parsed JSON → its problems, one line each. Pure.
export function problems(file, lock, allowed = ALLOWED) {
  const out = [];
  for (const [where, pkg] of Object.entries(lock.packages ?? {})) {
    if (!where) continue; // the project itself
    const name = pkg.name ?? where.split('node_modules/').pop();
    const lic = typeof pkg.license === 'object' ? pkg.license?.type : pkg.license;
    if (lic == null || permissive(lic) || allowedBy(name, allowed)) continue;
    out.push(`${file}: ${name}@${pkg.version} is ${lic}`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = LOCKFILES.flatMap((f) =>
    problems(f, JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))),
  );
  const today = new Date().toISOString().slice(0, 10);
  for (const [p, , by] of ALLOWED)
    if (by < today) console.warn(`Licences: the ${p} allowance was due for review on ${by}`);
  if (found.length) {
    console.error(
      `GPL-family licences (scripts/check-licences.mjs lists the allowed ones):\n- ${found.join('\n- ')}`,
    );
    process.exit(1);
  }
  console.log('Licences: no GPL, LGPL or AGPL packages ✓');
}
