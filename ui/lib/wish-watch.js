// Wishlist Watch (Home): one generic row per wishlist item, whatever it is (a ship,
// a pack, a paint, gear, an add-on or a CCU), so the website's catalog feed can
// replace today's per-ship store checks later without touching the card.
//   { kind: 'ship'|'pack'|'paint'|'gear'|'addon'|'ccu', name, from?, to?,
//     price (USD, what it sells for now, or its usual price), warbond (USD, the
//     Warbond edition's price when it's cheaper) | null, status, url, img }
// status: 'in' (In Store Now), 'pack' (Only in a Pack), 'out' (Not on Sale),
// 'soldout' (Sold Out), 'unknown' (not checked yet). Pure.
export const WISH_KINDS = {
  ship: 'Ship',
  pack: 'Pack',
  paint: 'Paint',
  gear: 'Gear',
  addon: 'Add-On',
  ccu: 'CCU',
};
export const WISH_STATUS = {
  in: 'In Store Now',
  pack: 'Only in a Pack',
  out: 'Not on Sale',
  soldout: 'Sold Out',
  unknown: 'Not Checked Yet',
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
const rsiUrl = (v) => (/^https:\/\/robertsspaceindustries\.com\//.test(v || '') ? v : null);

export function wishRow(raw) {
  const r = raw || {};
  const kind = WISH_KINDS[r.kind] ? r.kind : 'ship';
  const from = kind === 'ccu' ? text(r.from) : '';
  const to = kind === 'ccu' ? text(r.to) : '';
  const name = text(r.name) || (from && to ? `${from} to ${to}` : '');
  const status = WISH_STATUS[r.status] ? r.status : 'unknown';
  const price = num(r.price);
  const wb = num(r.warbond);
  const url = rsiUrl(r.url);
  return {
    kind,
    kindLabel: WISH_KINDS[kind],
    name,
    from,
    to,
    price,
    // Warbond savings only when it's on sale and really cheaper.
    warbond: status === 'in' && wb && price && wb < price ? wb : null,
    status,
    statusLabel: WISH_STATUS[status],
    // Buy only when it can be bought on its own right now (never on Not on Sale).
    buyable: status === 'in' && !!url,
    url,
    img: text(r.img),
  };
}

// "2 of 5 on sale on their own" for the card's summary.
export function wishSummary(rows) {
  const on = rows.filter((r) => r.status === 'in').length;
  return { on, total: rows.length };
}

// "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago".
export function checkedAgo(t, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
