// Build flags (src/flags.js, docs/FLAGS.md): reading the registry, choosing each
// build's values, writing them into the built flags.js, and cutting the code of the
// flags that are off. Used by scripts/pack.mjs and scripts/check-store-build.mjs.
//
// Markers: a line mentioning "@flag-start <name>" starts a block, "@flag-end <name>"
// ends it, and both lines go with it when the flag is off. "@sync-start" and
// "@sync-end" are the older spelling of the `sync` flag's markers. Blocks never nest.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

export const FLAGS_FILE = 'src/flags.js';
const NAME = /^[a-z][A-Za-z0-9]*$/;
const KEYS = ['about', 'default', 'beta', 'devOnly'];
const VALUES_LINE = 'const BUILD_VALUES = {};';

// Runs a flags.js (source or built) in a sandbox: { registry, values }, as plain data.
export function loadFlags(text, file = FLAGS_FILE) {
  const ctx = vm.createContext({});
  vm.runInContext(text, ctx, { filename: file });
  const OH = ctx.OH || {};
  if (!OH.flags || !OH.flagRegistry) throw new Error(`${file}: doesn't set OH.flags`);
  return JSON.parse(JSON.stringify({ registry: OH.flagRegistry, values: OH.flags }));
}

export function readRegistry(file = FLAGS_FILE) {
  const { registry } = loadFlags(readFileSync(file, 'utf8'), file);
  validateRegistry(registry, file);
  return registry;
}

export function validateRegistry(registry, file = FLAGS_FILE) {
  const bad = (name, why) => {
    throw new Error(`${file}: flag "${name}" ${why}`);
  };
  if (!registry || typeof registry !== 'object') throw new Error(`${file}: no registry`);
  for (const [name, f] of Object.entries(registry)) {
    if (!NAME.test(name)) bad(name, 'needs a camelCase name (letters and digits)');
    for (const k of Object.keys(f)) if (!KEYS.includes(k)) bad(name, `has an unknown key "${k}"`);
    if (typeof f.about !== 'string' || !f.about.trim() || /\n/.test(f.about))
      bad(name, 'needs a one-line `about`');
    if (typeof f.default !== 'boolean') bad(name, 'needs `default: true` or `default: false`');
    for (const k of ['beta', 'devOnly'])
      if (k in f && typeof f[k] !== 'boolean') bad(name, `has a \`${k}\` that isn't true/false`);
    if (f.devOnly && (f.default || f.beta))
      bad(name, 'is dev-only, so it must be off in store builds');
  }
  return registry;
}

// "--flag name=on" (or --flag=name=on), repeatable: { name: true/false }.
export function parseFlagArgs(args, registry) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    let spec;
    if (args[i] === '--flag') spec = args[++i];
    else if (args[i].startsWith('--flag=')) spec = args[i].slice('--flag='.length);
    else continue;
    const m = /^([^=]+)=(on|off)$/.exec(spec || '');
    if (!m) throw new Error(`--flag needs name=on or name=off (got "${spec || ''}")`);
    if (!Object.hasOwn(registry, m[1]))
      throw new Error(`--flag ${m[1]}: no such flag in ${FLAGS_FILE}`);
    out[m[1]] = m[2] === 'on';
  }
  return out;
}

// A build's values: the store defaults, or the beta set, then the dev overrides.
export function buildValues(registry, { beta = false, overrides = {} } = {}) {
  const values = {};
  for (const [name, f] of Object.entries(registry))
    values[name] = beta && 'beta' in f ? f.beta : f.default;
  for (const [name, on] of Object.entries(overrides)) {
    if (!Object.hasOwn(registry, name)) throw new Error(`no such flag "${name}" in ${FLAGS_FILE}`);
    values[name] = on;
  }
  return values;
}

// Writes the values into a built copy of flags.js, the way pack.mjs presets the site.
export function writeFlags(file, values) {
  const src = readFileSync(file, 'utf8');
  if (src.split(VALUES_LINE).length !== 2)
    throw new Error(`${file}: expected one "${VALUES_LINE}"`);
  writeFileSync(file, src.replace(VALUES_LINE, `const BUILD_VALUES = ${JSON.stringify(values)};`));
}

const MARKER = /@(?:(sync)-(start|end)|flag-(start|end)\b[ \t]*([A-Za-z0-9_]*))/;

// Cuts the blocks of the flags that are off from one file's text. Fails loudly on a
// marker for an unknown (or retired) flag, a block inside another, a mismatched end
// and a block left open. Blocks of flags that are on stay, markers included.
export function stripFlags(text, values, file = '(text)') {
  const out = [];
  let open = null; // { name, line }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = MARKER.exec(line);
    if (!m) {
      if (!open || values[open.name]) out.push(line);
      return;
    }
    const at = `${file}:${i + 1}`;
    const name = m[1] || m[4];
    const kind = m[2] || m[3];
    const tag = m[1] ? `@sync-${kind}` : `@flag-${kind} ${name}`;
    if (!name) throw new Error(`${at}: @flag-${kind} needs a flag name`);
    if (!Object.hasOwn(values, name))
      throw new Error(`${at}: ${tag} names no flag in ${FLAGS_FILE} (retired? remove the block)`);
    if (kind === 'start') {
      if (open)
        throw new Error(`${at}: ${tag} inside the "${open.name}" block from line ${open.line}`);
      open = { name, line: i + 1 };
    } else {
      if (!open) throw new Error(`${at}: ${tag} without a start`);
      if (open.name !== name)
        throw new Error(`${at}: ${tag} closes the "${open.name}" block from line ${open.line}`);
      open = null;
    }
    if (values[name]) out.push(line);
  });
  if (open) throw new Error(`${file}:${open.line}: the "${open.name}" block is never closed`);
  return out.join('\n');
}

// Every script, page and stylesheet under dir, except the registry itself.
export function stripFlagsInDir(dir, values) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) stripFlagsInDir(p, values);
    else if (/\.(js|html|css)$/.test(e.name) && !p.endsWith(FLAGS_FILE)) {
      const text = readFileSync(p, 'utf8');
      const cut = stripFlags(text, values, p);
      if (cut !== text) writeFileSync(p, cut);
    }
  }
}
