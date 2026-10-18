// npm run privacy:plain: writes docs/store-assets/privacy-plain.txt from docs/PRIVACY.md.
//
// The plain-text copy of the extension's privacy policy, for store forms that take the
// policy as text. It is the policy's words in the same order, with only the Markdown
// taken out: headings lose their # marks (section headings in capitals), bold, italic
// and code marks go, and a link shows its text, then its address in parentheses when
// the text isn't the address (a link to a section of the policy shows just its text).
// List items keep "- ". Markdown this doesn't know (a table, a quote, HTML, a \ escape)
// stops it with an error rather than slipping into the file. Run this after changing the policy;
// test/privacy-plain.test.js fails while the two differ.
//
// It also writes docs/store-assets/privacy-amo.md, the text the owner pastes into AMO's
// Privacy Policy box. AMO's Markdown has no headings, so the title line is dropped, each
// heading becomes a bold line, and a link to a section of the policy becomes its text.
// Everything else is the policy as written.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const POLICY_FILE = 'docs/PRIVACY.md';
export const PLAIN_FILE = 'docs/store-assets/privacy-plain.txt';
export const AMO_FILE = 'docs/store-assets/privacy-amo.md';

// Code spans, links, <autolinks> and bare addresses: their insides are never read as
// emphasis, so an address with _ or * in it stays whole.
const INLINE =
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|<((?:https?|mailto):[^>\s]+)>|(https?:\/\/[^\s)]+)/g;
const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
// Block Markdown with no plain-text rule here: quotes, tables, HTML, images, fences,
// rules and underlined headings.
const UNKNOWN_BLOCK = /^\s*(?:>|\||<[a-z!/]|!\[|```|~~~|(?:[-*_]\s*){3,}$|=+\s*$)/i;

const emphasis = (s) =>
  s
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/(^|[^\w*])([*_])(?=\S)(.+?)(?<=\S)\2(?![\w*])/g, '$1$3');

function link(text, url) {
  if (url.startsWith('#')) return text;
  const address = url.replace(/^mailto:/, '');
  return text === address || text === url ? text : `${text} (${address})`;
}

// One line's inline Markdown, as plain text.
function inline(line, where) {
  let out = '';
  let last = 0;
  const text = (s) => {
    const plain = emphasis(s);
    if (/[*`\\]|\]\(/.test(plain)) throw new Error(`${where}: Markdown left in "${plain}"`);
    return plain;
  };
  for (const m of line.matchAll(INLINE)) {
    out += text(line.slice(last, m.index));
    const [, code, label, url, auto, bare] = m;
    if (code !== undefined) out += code;
    else if (label !== undefined) out += link(text(label), url);
    else out += (auto ?? bare).replace(/^mailto:/, '');
    last = m.index + m[0].length;
  }
  return out + text(line.slice(last));
}

export function plainPolicy(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out = lines.map((raw, i) => {
    const where = `${POLICY_FILE}:${i + 1}`;
    const line = raw.trimEnd();
    if (UNKNOWN_BLOCK.test(line))
      throw new Error(`${where}: no plain-text rule for this Markdown yet (${line})`);
    const heading = HEADING.exec(line);
    if (heading) {
      const title = inline(heading[2], where);
      return heading[1].length === 1 ? title : title.toUpperCase();
    }
    return inline(line.replace(/^(\s*)[*+]\s+/, '$1- '), where);
  });
  return out.join('\n').replace(/\n*$/, '\n');
}

export function amoPolicy(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  lines.forEach((raw, i) => {
    const where = `${POLICY_FILE}:${i + 1}`;
    const line = raw.trimEnd();
    const heading = HEADING.exec(line);
    if (!heading) return out.push(line.replace(/\[([^\]]+)\]\(#[^)\s]*\)/g, '$1'));
    if (heading[1].length === 1) return; // AMO shows the add-on's name: no title line
    if (/[*_`[\<]/.test(heading[2])) throw new Error(`${where}: Markdown in a heading`);
    out.push(`**${heading[2]}**`);
  });
  return out.join('\n').replace(/^\n+/, '').replace(/\n*$/, '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const policy = readFileSync(ROOT + POLICY_FILE, 'utf8');
  writeFileSync(ROOT + PLAIN_FILE, plainPolicy(policy));
  writeFileSync(ROOT + AMO_FILE, amoPolicy(policy));
  console.log(`wrote ${PLAIN_FILE} and ${AMO_FILE} from ${POLICY_FILE}`);
}
