'use strict';

/*
 * All HTML insertion goes through setHTML (src/safe-html.js). This check reads every
 * page script in src/, ui/, beta/, site/ and site-worker/ and fails on any other way
 * of putting markup on a page. src/ui/ is Vite's output (Svelte's runtime builds its
 * own templates there), so the check reads the Svelte sources in ui/ instead.
 * Text read from RSI goes in as text: textContent, or {value} in Svelte.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['src', 'ui', 'beta', 'site', 'site-worker'];
const SKIP = new Set(['src/ui', 'src/safe-html.js']);
const EXT = /\.(js|mjs|svelte|html)$/;

// Each way of turning a string into DOM nodes on a live page.
const BANNED = [
  [/\.(innerHTML|outerHTML)\s*\+?=(?!=)/, 'innerHTML/outerHTML assignment'],
  [/\binsertAdjacentHTML\s*\(/, 'insertAdjacentHTML'],
  [/\bdocument\s*\.\s*write(ln)?\s*\(/, 'document.write'],
  [/\{@html\b/, 'Svelte {@html}'],
  [/\bcreateContextualFragment\s*\(/, 'createContextualFragment'],
  [/\.setHTML(Unsafe)?\s*\(|\bparseHTMLUnsafe\s*\(/, 'the browser’s own setHTML/parseHTMLUnsafe'],
  [/\bsrcdoc\b/, 'iframe srcdoc'],
  [/\b(importNode|adoptNode)\s*\(/, 'importNode/adoptNode (nodes from a parsed page)'],
];

function filesUnder(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return EXT.test(rel) ? [rel] : [];
  return fs
    .readdirSync(abs)
    .map((f) => `${rel}/${f}`)
    .filter((f) => !SKIP.has(f))
    .flatMap(filesUnder);
}

function findings(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    // Whole-line comments (//, a /* */ block's *, <!-- -->) only talk about these.
    const t = line.trimStart();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) return;
    for (const [re, what] of BANNED) if (re.test(line)) out.push(`${i + 1}: ${what}`);
  });
  return out;
}

test('nothing inserts HTML except setHTML in src/safe-html.js', () => {
  const files = DIRS.flatMap(filesUnder);
  assert.ok(files.length > 50, `read ${files.length} files`);
  const bad = files.flatMap((f) =>
    findings(fs.readFileSync(path.join(ROOT, f), 'utf8')).map((x) => `${f}:${x}`),
  );
  assert.deepEqual(bad, [], 'use textContent for text, setHTML (src/safe-html.js) for markup');
});

test('the check catches each way in', () => {
  for (const line of [
    'el.innerHTML = name;',
    'el.outerHTML += x',
    "el.insertAdjacentHTML('beforeend', x)",
    'document.write(x)',
    '<svg>{@html icon}</svg>',
    'range.createContextualFragment(x)',
    'el.setHTML(x)',
    'el.setHTMLUnsafe(x)',
    'Document.parseHTMLUnsafe(x)',
    'frame.srcdoc = x',
    'document.importNode(n, true)',
  ])
    assert.equal(findings(line).length, 1, line);
  for (const line of [
    'const html = el.innerHTML;',
    'if (a.innerHTML === b) {}',
    '// never el.innerHTML = x',
    'setHTML(el, x);',
    'el.textContent = name;',
  ])
    assert.deepEqual(findings(line), [], line);
});
