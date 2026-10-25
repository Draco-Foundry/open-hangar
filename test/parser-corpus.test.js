'use strict';

/*
 * The parser over real RSI pages: test/fixtures/corpus/ holds saved hangar and
 * buy-back pages, scrubbed by scripts/scrub-capture.mjs (README there).
 *   - Nothing unrecognized: the parser report (test/parser-report.js) counts 0
 *     pledges, items, tags, labels and hooks the parser doesn't know.
 *   - Cross-checks against numbers RSI prints and the parser doesn't read: each
 *     card's "Contains:" line counts its items, and the pager's links say which page
 *     this is and how many there are, so a page before the last holds a full page.
 *   - No personal data in any fixture.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM } = require('jsdom');
const { CORPUS, corpus, load, report, pageReport } = require('./parser-report.js');

const { P, RULES } = load();
const PAGES = corpus();
const hangarPages = PAGES.filter((p) => p.kind === 'hangar');
const buybackPages = PAGES.filter((p) => p.kind === 'buybacks');
const doc = (html) => new JSDOM(html).window.document;
const clean = (s) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim();

test('the corpus has real hangar and buy-back pages', () => {
  assert.ok(hangarPages.length >= 1, 'a hangar page in test/fixtures/corpus/');
  assert.ok(buybackPages.length >= 1, 'a buy-back page in test/fixtures/corpus/');
  for (const p of hangarPages) assert.ok(P.parsePledges(p.html).length > 0, p.file);
  for (const p of buybackPages) assert.ok(P.parseBuybacks(p.html).length > 0, p.file);
});

test('the parser recognizes every pledge, item, tag, label and hook in the corpus', () => {
  const r = report();
  const lines = Object.values(r.found).flat();
  assert.deepEqual(
    r.counts,
    { pledges: 0, items: 0, tags: 0, labels: 0, hooks: 0 },
    `not recognized (add a fixture and a rule in src/data/parser-rules.json, never a skip):\n${lines.join('\n')}`,
  );
});

test('the report counts a shape it has never seen', () => {
  const page = hangarPages[0];
  const changed = page.html
    .replace('>Attributed<', '>Reserved<')
    .replace(' js-gift ', ' js-lend js-gift ')
    .replace('>Created:<', '>Bought:<');
  const r = pageReport({ ...page, html: changed }, { P, RULES });
  assert.ok(
    r.tags.some((l) => l.includes('"Reserved"')),
    r.tags.join('\n'),
  );
  assert.ok(
    r.hooks.some((l) => l.includes('js-lend')),
    r.hooks.join('\n'),
  );
  assert.ok(
    r.labels.some((l) => l.includes('"Bought:"')),
    r.labels.join('\n'),
  );

  const item = '<div class="kind">Hologram</div>';
  const withItem = page.html.replace('<div class="text">', `<div class="text">${item}`);
  const r2 = pageReport({ ...page, html: withItem }, { P, RULES });
  assert.ok(
    r2.items.some((l) => l.includes('"Hologram"')),
    r2.items.join('\n'),
  );
});

// RSI's "Contains:" line: "23 items", "<ship> and 2 items", "4 ships and 2 items", or
// a single item's name. The parser reads the item tiles, never this line.
function containsCount(text) {
  const t = clean(text).replace(/^Contains:\s*/i, '');
  let m = t.match(/^(\d+) items?$/i);
  if (m) return Number(m[1]);
  m = t.match(/^(\d+) ships? and (\d+) items?$/i);
  if (m) return Number(m[1]) + Number(m[2]);
  m = t.match(/ and (\d+) items?$/i);
  if (m) return 1 + Number(m[1]);
  return t ? 1 : 0;
}

test("each pledge holds as many items as RSI's Contains line says", () => {
  let checked = 0;
  for (const page of hangarPages) {
    const pledges = P.parsePledges(page.html);
    const lines = new Map(
      [...doc(page.html).querySelectorAll(RULES.hangar.id)].map((input) => [
        input.value,
        input.closest('li')?.querySelector('.items-col')?.textContent,
      ]),
    );
    for (const p of pledges) {
      const line = lines.get(p.id);
      if (line == null) continue;
      assert.equal(p.contents.length, containsCount(line), `${page.file}: pledge ${p.id}`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no Contains lines found');
});

// The pager: the active link is this page, the last link (») the last page, and a
// buy-back page's links carry the page size RSI used.
function pager(html) {
  const links = [...doc(html).querySelectorAll('.pager a[href]')];
  const num = (a, key) =>
    Number((a?.getAttribute('href') || '').match(new RegExp(`[?&]${key}=(\\d+)`))?.[1]);
  const active = links.find((a) => a.classList.contains('active'));
  const last = Math.max(...links.map((a) => num(a, 'page')).filter(Number.isFinite));
  return { page: Number(clean(active?.textContent)), last, size: num(active, 'pagesize') };
}

test('a hangar page before the last one holds a full page of pledges', () => {
  for (const page of hangarPages) {
    const { page: n, last } = pager(page.html);
    assert.equal(n, Number(page.file.match(/page-(\d+)/)[1]), `${page.file}: the active page`);
    assert.ok(last >= n, `${page.file}: last page ${last}`);
    // Saved pages are RSI's default, 10 a page: the size the scan asks for too.
    if (n < last) assert.equal(P.parsePledges(page.html).length, RULES.hangar.pageSize, page.file);
  }
});

// #568: the maker line under an item's name, kept as RSI wrote it, on exactly the
// tiles that show one. The DOM's own tiles are the cross-check.
test("a hangar item's maker is RSI's maker line, on the tiles that show one", () => {
  let shown = 0;
  for (const page of hangarPages) {
    const tiles = [...doc(page.html).querySelectorAll('.item')]
      .map((t) => ({
        kind: clean(t.querySelector('.kind')?.textContent),
        label: clean(t.querySelector('.title')?.textContent),
        maker: clean(t.querySelector('.liner')?.textContent),
      }))
      .filter((t) => t.kind || t.label);
    const items = P.parsePledges(page.html).flatMap((p) => p.contents);
    assert.equal(items.length, tiles.length, `${page.file}: every tile read`);
    items.forEach((c, i) => {
      if (tiles[i].maker) assert.equal(c.manufacturer, tiles[i].maker, `${page.file} ${c.label}`);
      else assert.equal('manufacturer' in c, false, `${page.file} ${c.label}: no maker line`);
    });
    shown += tiles.filter((t) => t.maker).length;
  }
  assert.ok(shown > 0, 'the corpus has tiles with a maker line');
  const one = hangarPages
    .flatMap((p) => P.parsePledges(p.html).flatMap((x) => x.contents))
    .find((c) => c.manufacturer);
  assert.match(one.manufacturer, /^\S.* \([A-Z0-9]{2,5}\)$/, 'name and code, as RSI shows them');
});

test('a buy-back page before the last one holds a full page at the size RSI shows', () => {
  for (const page of buybackPages) {
    const { page: n, last, size } = pager(page.html);
    assert.ok(Number.isFinite(size), `${page.file}: page size in the pager links`);
    if (n < last) assert.equal(P.parseBuybacks(page.html).length, size, page.file);
  }
});

// Every fixture, not only the corpus: no email address, and none of the handles
// listed in OH_PRIVATE_HANDLES (comma-separated) or in captures/handles.txt
// (gitignored, one per line), which a maintainer keeps locally.
function privateHandles() {
  const list = (process.env.OH_PRIVATE_HANDLES || '').split(',');
  try {
    list.push(
      ...fs
        .readFileSync(path.join(__dirname, '..', 'captures', 'handles.txt'), 'utf8')
        .split(/\r?\n/),
    );
  } catch {
    // no local list
  }
  return list.map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function fixtureFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? fixtureFiles(p) : [p];
  });
}

test('no fixture holds an email address or a private handle', () => {
  const handles = privateHandles();
  for (const file of fixtureFiles(path.join(__dirname, 'fixtures'))) {
    const text = fs.readFileSync(file, 'utf8');
    const name = path.relative(__dirname, file).split(path.sep).join('/');
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+(\.[\w-]+)+/, `${name}: an email address`);
    const lower = text.toLowerCase();
    for (const h of handles) assert.ok(!lower.includes(h), `${name}: a private handle`);
  }
  for (const file of fixtureFiles(CORPUS)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /citizens\//i, `${file}: a citizen link`);
  }
});

test('the scrub script keeps the cards and replaces what says whose hangar it is', async () => {
  const { scrub, PRICE, DATE } = await import(
    pathToFileURL(path.join(__dirname, '..', 'scripts', 'scrub-capture.mjs')).href
  );
  const saved = `<!doctype html><html><head><script>var token = "secret-123";</script></head>
    <body><header class="account">Signed in as PilotTest99, pilot@example.com</header>
    <ul class="list-items"><li><div class="row">
      <h3>Standalone Ships - Avenger Titan</h3>
      <input class="js-pledge-id" value="12345678">
      <input class="js-pledge-name" value="Standalone Ships - Avenger Titan">
      <input class="js-pledge-value" value="$70.00 USD">
      <input class="js-upgrade-data" value='{"id":12345678,"name":"x"}'>
      <script class="js-pledge-nameable-ships" type="application/json">{"1":"My Ship"}</script>
      <span class="availability">Attributed</span>
      <div class="date-col"><label>Created:</label> April 12, 2023</div>
      <div class="items-col"><label>Contains:</label> Avenger Titan</div>
      <a class="js-gift" href="/citizens/PilotTest99">Gift PilotTest99</a>
      <div class="item"><div class="image" style="background-image:url('/media/abc/x.jpg')"></div>
        <div class="text"><div class="kind">Ship</div><div class="title">Avenger Titan</div></div></div>
    </div></li></ul>
    <div class="pager"><a class="active" href="/account/pledges?page=1">1</a></div>
    <footer>Contact support@example.com</footer></body></html>`;
  const out = scrub(saved, { handles: ['PilotTest99'] });
  for (const gone of [
    'secret-123',
    'example.com',
    'PilotTest99',
    '12345678',
    '$70.00',
    'April 12',
    'My Ship',
    '/media/abc',
    'citizens/',
  ]) {
    assert.ok(!out.includes(gone), `still holds ${gone}`);
  }
  const [p] = P.parsePledges(out);
  assert.equal(p.name, 'Standalone Ships - Avenger Titan');
  assert.equal(p.id, '9000001');
  assert.equal(p.value, Number(PRICE.replace(/[^0-9.]/g, '')));
  assert.equal(p.date, P.parseRsiDate(DATE));
  assert.equal(p.kind, 'ship');
  assert.equal(p.giftable, true);
  assert.match(out, /href="\?page=1"/);
});

// RSI changed the page (OpenHangar.pageChanged, which every scan runs on each page): the
// saved pages fit the rules as they are, and the same pages changed the way RSI might
// change them (test/fixtures/page-change/, each says what changed) don't.
test('a page RSI changed trips the page change check, an unchanged one never does', () => {
  for (const p of PAGES) assert.deepEqual(P.pageChanged(p.html, p.kind), [], p.file);
  const changed = (f) =>
    fs.readFileSync(path.join(__dirname, 'fixtures', 'page-change', f), 'utf8');
  assert.deepEqual(P.pageChanged(changed('hangar-changed.html'), 'hangar'), [
    'no pledge date reads',
  ]);
  assert.deepEqual(P.pageChanged(changed('buybacks-changed.html'), 'buybacks'), [
    'buy-back cards without names',
  ]);
  // A page with no cards (signed out, an empty list) is for the scan's other checks.
  assert.deepEqual(P.pageChanged('<html><body></body></html>', 'hangar'), []);
  assert.deepEqual(P.pageChanged('<html><body></body></html>', 'buybacks'), []);
});
