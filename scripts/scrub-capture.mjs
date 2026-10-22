// Scrubs a saved RSI hangar or buy-back page into a test fixture (test/fixtures/corpus/).
// The repo is public, so a capture keeps only what the parser reads, and nothing that
// says whose hangar it is:
//   - only the pledge list, its pager and the buy-back token line are kept: the page
//     header (handle, avatar, balances), scripts, tokens, forms and footers are dropped;
//   - every number of 6 digits or more (pledge, ship and upgrade ids, order numbers)
//     becomes a fixed placeholder, the same one each time it repeats on the page;
//   - prices become $10.00 USD and dates January 01, 2026 (owner, 2026-10-18: which
//     pledges a hangar holds is private enough without its prices and dates);
//   - images, links, the upgrade data and ship-name JSON become placeholders, emails
//     become [email], and each --handle given becomes PILOT_HANDLE.
// test/parser-corpus.test.js fails if a fixture still holds an email or a citizen link.
//
//   node scripts/scrub-capture.mjs <saved page> <fixture.html> [--handle NAME]...
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

export const PRICE = '$10.00 USD';
export const DATE = 'January 01, 2026';
export const IMAGE = 'https://robertsspaceindustries.com/media/placeholder.jpg';
export const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

// The attributes worth keeping; the rest (ids, data-* tracking, inline handlers) go.
const KEEP_ATTRS = new Set([
  'class',
  'type',
  'value',
  'style',
  'src',
  'href',
  'rel',
  'data-pledgeid',
  'data-fromshipid',
  'data-toshipid',
  'data-toskuid',
]);
const DROP_TAGS = 'script:not(.js-pledge-name-reservations):not(.js-pledge-nameable-ships), style, link, meta, iframe, noscript, form, svg, template';
const DATE_TEXT = /\b[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}\b/g;

function scrubDates(root) {
  const walk = root.ownerDocument.createTreeWalker(root, 4);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (DATE_TEXT.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(DATE_TEXT, DATE);
  }
}

// What a saved page is, and the parts of it to keep.
function parts(doc) {
  const card = doc.querySelector('.js-pledge-id');
  if (card) return { kind: 'hangar', keep: [card.closest('ul') || card.closest('.row')] };
  const article = doc.querySelector('article');
  if (!article) return null;
  let list = article.parentElement;
  while (list && list.querySelectorAll('article').length < doc.querySelectorAll('article').length)
    list = list.parentElement;
  // The buy-back token line: the innermost element that holds the whole sentence.
  const says = (el) => /opportunit(y|ies) to buy back/i.test(el.textContent);
  const tokens = [...doc.querySelectorAll('p, div, span')].find(
    (el) => says(el) && ![...el.children].some(says),
  );
  return { kind: 'buybacks', keep: [tokens, list].filter(Boolean) };
}

export function scrub(html, { handles = [] } = {}) {
  const doc = new JSDOM(html).window.document;
  const found = parts(doc);
  if (!found) throw new Error('not a saved hangar or buy-back page');
  const pager = doc.querySelector('.pager');
  const out = new JSDOM('<!doctype html><html><body></body></html>').window.document;
  for (const el of [...found.keep, pager].filter(Boolean)) {
    out.body.append(out.importNode(el, true), out.createTextNode('\n'));
  }

  out.body.querySelectorAll(DROP_TAGS).forEach((el) => el.remove());
  for (const el of out.body.querySelectorAll('*')) {
    for (const a of [...el.attributes]) if (!KEEP_ATTRS.has(a.name)) el.removeAttribute(a.name);
    if (el.hasAttribute('style') && /url\(/i.test(el.getAttribute('style')))
      el.setAttribute('style', `background-image: url('${IMAGE}');`);
    if (el.hasAttribute('src')) el.setAttribute('src', IMAGE);
    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href');
      // Pager links keep their page numbers (the corpus test reads the last page), and
      // RSI's own paths stay (a buy-back's id is in its link; numbers are replaced
      // below). Anything else, and any citizen page, becomes '#'.
      const page = href.match(/[?&]page=\d+(&pagesize=\d+)?/);
      const own = href.startsWith('/') && !href.startsWith('//') && !/citizens/i.test(href);
      el.setAttribute('href', page ? `?${page[0].slice(1)}` : own ? href : '#');
    }
  }
  out.body.querySelectorAll('.js-pledge-name-reservations').forEach((el) => (el.textContent = '[]'));
  out.body.querySelectorAll('.js-pledge-nameable-ships').forEach((el) => (el.textContent = '{}'));
  out.body.querySelectorAll('.js-upgrade-data').forEach((el) => el.setAttribute('value', '{}'));
  out.body
    .querySelectorAll('.js-pledge-value, .js-pledge-configuration-value')
    .forEach((el) => el.setAttribute('value', PRICE));
  scrubDates(out.body);
  const walk = out.createTreeWalker(out.body, 128); // comments
  const comments = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) comments.push(n);
  comments.forEach((n) => n.remove());

  let text = out.body.innerHTML;
  // Long numbers: the same placeholder for the same number, in order of appearance.
  const ids = new Map();
  text = text.replace(/\b\d{6,}\b/g, (n) => {
    if (!ids.has(n)) ids.set(n, String(9000001 + ids.size));
    return ids.get(n);
  });
  text = text.replace(EMAIL, '[email]');
  for (const h of handles.filter(Boolean)) {
    text = text.replace(new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'PILOT_HANDLE');
  }
  // Indentation and blank lines only (the parser collapses whitespace).
  text = text.replace(/[ \t]+$/gm, '').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');

  return `<!doctype html>
<!--
  A real RSI ${found.kind === 'hangar' ? 'hangar (/account/pledges)' : 'buy-back (/account/buy-back-pledges)'} page, scrubbed by
  scripts/scrub-capture.mjs: ids, prices, dates, images, links and account details are
  placeholders. See test/fixtures/corpus/README.md.
-->
<html>
<body>
${text.trim()}
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const handles = [];
  for (let i = args.indexOf('--handle'); i !== -1; i = args.indexOf('--handle')) {
    handles.push(args[i + 1]);
    args.splice(i, 2);
  }
  const [from, to] = args;
  if (!from || !to) {
    console.error('usage: node scripts/scrub-capture.mjs <saved page> <fixture.html> [--handle NAME]...');
    process.exit(2);
  }
  writeFileSync(to, scrub(readFileSync(from, 'utf8'), { handles }));
  console.log(`scrub-capture: wrote ${to}`);
}
