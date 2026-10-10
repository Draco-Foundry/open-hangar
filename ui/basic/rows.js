// The basic page's lists (the connector build): pledges and buy-backs as plain rows,
// search, totals and the CSV export. Pure, so it's tested directly
// (test/basic-page.test.js). No pictures and nothing fetched: the page works offline.

// RSI's dates come as "2024-03-14" or "Jan 05, 2025"; kept as RSI wrote them.
const text = (v) => (v == null ? '' : String(v).trim());
const money = (v) => (Number.isFinite(v) ? v : null);

// The type's name on screen, in the words the other pages use (Wishlist, Inventory's
// type filters). The CSV keeps the key, for other tools.
const KIND_LABEL = {
  ship: 'Ship',
  pack: 'Pack',
  package: 'Game Package',
  paint: 'Paint',
  gear: 'Gear',
  addon: 'Add-On',
  ccu: 'CCU',
  coupon: 'Coupon',
  other: 'Other',
};
export const kindLabel = (k) => KIND_LABEL[k] || 'Other';

// A pledge (src/scraper/parser.js parsePledges) → a row.
export function pledgeRow(p) {
  const contents = (p.contents || []).map((c) => text(c.label)).filter(Boolean);
  return {
    id: text(p.id),
    name: text(p.name),
    kind: text(p.kind) || 'other',
    value: money(p.value),
    currency: text(p.currency) || 'USD',
    insurance: text(p.insurance),
    giftable: p.giftable === true,
    meltable: p.meltable !== false,
    date: text(p.date),
    contents,
    // What search looks through: the name, an upgrade's ships, what's inside.
    hay: [p.name, p.ccu && p.ccu.from, p.ccu && p.ccu.to, ...contents]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

// A buy-back (parseBuybacks), with what its own page said once read (bbDetails) → a row.
export function buybackRow(b, detail = null) {
  const d = detail && !detail.partial ? detail : null;
  return {
    id: text(b.id),
    name: text(b.name),
    kind: text(b.kind) || 'other',
    date: text(b.date),
    contains: text(b.contains),
    insurance: text((d && d.insurance) || b.insurance),
    // The pledge's price on its buy-back page, when that page has been read.
    price: money(d && d.price),
    hay: [b.name, b.contains, b.ccu && b.ccu.from, b.ccu && b.ccu.to]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

// Every word of the search in the row, in any order ("lti cutlass").
export function search(rows, q) {
  const words = String(q || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => words.every((w) => r.hay.includes(w)));
}

// → { count, value } where value is the sum of the known values (melt value for
// pledges, the buy-back page's price for buy-backs), and `priced` how many had one.
export function totals(rows, key = 'value') {
  let value = 0;
  let priced = 0;
  for (const r of rows)
    if (Number.isFinite(r[key])) {
      value += r[key];
      priced++;
    }
  return { count: rows.length, value: Math.round(value * 100) / 100, priced };
}

// One CSV cell (RFC 4180). A cell a spreadsheet would run as a formula (=, +, -, @,
// a tab or a carriage return first) gets a ' in front, so a pledge name can't.
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (head, rows) =>
  [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

// The CSVs: column names are data for other tools, so they stay plain English.
export function pledgesCsv(rows) {
  return csv(
    [
      'id',
      'name',
      'type',
      'value',
      'currency',
      'insurance',
      'giftable',
      'meltable',
      'date',
      'contents',
    ],
    rows.map((r) => [
      r.id,
      r.name,
      r.kind,
      r.value ?? '',
      r.currency,
      r.insurance,
      r.giftable ? 'yes' : 'no',
      r.meltable ? 'yes' : 'no',
      r.date,
      r.contents.join('; '),
    ]),
  );
}
export function buybacksCsv(rows) {
  return csv(
    ['id', 'name', 'type', 'date', 'contains', 'insurance', 'price'],
    rows.map((r) => [r.id, r.name, r.kind, r.date, r.contains, r.insurance, r.price ?? '']),
  );
}

// A file name for an export: open-hangar-<what>-<handle>-<date>.<ext>, safe characters.
export function exportName(what, handle, ext, now = new Date()) {
  const who = handle ? `-${handle}` : '';
  const date = now.toISOString().slice(0, 10);
  return `open-hangar-${what}${who}-${date}.${ext}`.replace(/[^\w.-]+/g, '_');
}
