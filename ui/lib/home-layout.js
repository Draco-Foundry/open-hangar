// Customize Home (0.3.0: show and hide; reorder and sizes come later). Pure logic,
// shared by the Customize drawer and Home (ui/lib/home-layout.svelte.js keeps the
// state and saves it). A layout is { v, cards: { id: shown } }; `v` lets later
// versions add order and sizes without breaking saved ones.
//
// Home is a 12-column grid. Each card has a width on wide windows and one on
// narrower ones (about 1100px); cards flow into rows left to right, and when a row
// has columns left over, the last card in it stretches to fill them, so every row
// ends level whatever is hidden. Phones get one column.
export const LAYOUT_VERSION = 1;
export const MAX_SAVED = 10;
export const MAX_NAME = 24;

// id, name, shown by default, columns (wide, narrower), note in the drawer.
export const HOME_CARDS = [
  { id: 'citizen', name: 'Citizen Card', pinned: true, on: true, wide: 12, mid: 12 },
  { id: 'value', name: 'Account Value', on: true, wide: 4, mid: 6 },
  { id: 'acquisitions', name: 'Latest Acquisitions', on: true, wide: 4, mid: 6 },
  { id: 'wishlist', name: 'Wishlist Watch', on: true, wide: 4, mid: 6 },
  { id: 'quicklinks', name: 'Quick Links', on: true, wide: 12, mid: 12 },
  {
    id: 'spotlight',
    name: 'Hangar Spotlight',
    on: false,
    wide: 4,
    mid: 6,
    note: 'A different ship from your fleet each visit',
  },
  {
    id: 'referrals',
    name: 'Referrals',
    on: false,
    wide: 4,
    mid: 6,
    note: 'Your recruits and the next reward',
  },
];
const IDS = HOME_CARDS.map((c) => c.id);

export const defaultCards = () => Object.fromEntries(HOME_CARDS.map((c) => [c.id, c.on]));
export const DEFAULT_NAME = 'Default';

// Whatever was saved (or nothing) → a clean layout: every known card set, unknown
// ones dropped, the pinned Citizen Card always on.
export function normalizeCards(raw) {
  const out = defaultCards();
  if (raw && typeof raw === 'object')
    for (const id of IDS) if (typeof raw[id] === 'boolean') out[id] = raw[id];
  out.citizen = true;
  return out;
}

export const cleanName = (s) =>
  String(s || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);

// The stored preference ({ v, cards, saved: [{ name, v, cards }] }) → a clean one.
// `legacyQlHidden`: the old Quick Links Hide Card switch (uiQuickLinksHidden), used
// only when nothing newer was saved.
export function normalizePref(raw, legacyQlHidden = false) {
  const cards = normalizeCards(raw && raw.cards);
  if (!raw && legacyQlHidden === true) cards.quicklinks = false;
  const saved = [];
  const seen = new Set([DEFAULT_NAME.toLowerCase()]);
  for (const l of (raw && Array.isArray(raw.saved) && raw.saved) || []) {
    const name = cleanName(l && l.name);
    if (!name || seen.has(name.toLowerCase()) || saved.length >= MAX_SAVED) continue;
    seen.add(name.toLowerCase());
    saved.push({ name, v: LAYOUT_VERSION, cards: normalizeCards(l.cards) });
  }
  return { v: LAYOUT_VERSION, cards, saved };
}

// Save the cards on show under a name. → { ok, pref } or { ok: false, error }.
export function saveLayout(pref, rawName) {
  const name = cleanName(rawName);
  if (!name) return { ok: false, error: 'Give it a name first.' };
  if (name.toLowerCase() === DEFAULT_NAME.toLowerCase())
    return { ok: false, error: 'Default is taken. Try another name.' };
  if (pref.saved.some((l) => l.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: `You already have a layout called ${name}.` };
  if (pref.saved.length >= MAX_SAVED)
    return { ok: false, error: `Ten layouts is the limit. Delete one to save another.` };
  const layout = { name, v: LAYOUT_VERSION, cards: normalizeCards(pref.cards) };
  return { ok: true, pref: { ...pref, saved: [...pref.saved, layout] } };
}

export function deleteLayout(pref, name) {
  return { ...pref, saved: pref.saved.filter((l) => l.name !== name) };
}

// Apply a saved layout (or Default) to Home.
export function applyLayout(pref, name) {
  const l = name === DEFAULT_NAME ? null : pref.saved.find((x) => x.name === name);
  if (name !== DEFAULT_NAME && !l) return pref;
  return { ...pref, cards: l ? normalizeCards(l.cards) : defaultCards() };
}

// Which saved layout (or Default) matches what's on Home now, or ''.
export function currentLayoutName(pref) {
  const same = (c) => IDS.every((id) => !!c[id] === !!pref.cards[id]);
  if (same(defaultCards())) return DEFAULT_NAME;
  return (pref.saved.find((l) => same(l.cards)) || {}).name || '';
}

// Cards in order with their widths → each card's columns after stretching: the last
// card in a row takes the columns left over. `key`: 'wide' or 'mid'. Pure.
export function flowSpans(cards, key = 'wide') {
  const out = {};
  let row = [];
  let left = 12;
  const close = () => {
    if (row.length) out[row[row.length - 1].id] += left;
    row = [];
    left = 12;
  };
  for (const c of cards) {
    const span = Math.min(12, Math.max(1, c[key] || 12));
    if (span > left) close();
    out[c.id] = span;
    row.push(c);
    left -= span;
    if (!left) close();
  }
  close();
  return out;
}
