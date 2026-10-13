// Account Value's "Most Valuable" list (ui/home/ValueCard.svelte): your ship pledges
// by today's store price, from OH.hangarValue's per-pledge numbers (the same ones
// behind the card's "Ships $X"), so nothing new is fetched or priced. Pure.

// The pledges whose ships all have a store price, most valuable first, at most `n`.
//  { id, store, paid, gain }: `gain` is store price minus melt value, only when the
//  melt value is known and above $0 (the card's vs-melt rule, per pledge; a $0
//  reward or gift has nothing to compare with), otherwise null.
export function mostValuable(items, hv, n = 3) {
  if (!hv || !hv.pledges) return [];
  const out = [];
  for (const p of items || []) {
    const si = hv.pledges[p.id];
    if (!si || si.ccu || si.unpriced || !(si.store > 0)) continue;
    const paid = si.paid != null && si.paid > 0 ? si.paid : null;
    out.push({
      id: String(p.id),
      p,
      store: si.store,
      paid,
      gain: paid != null ? si.store - paid : null,
    });
  }
  out.sort((x, y) => y.store - x.store || String(x.id).localeCompare(String(y.id)));
  return out.slice(0, Math.max(0, n));
}

// Short insurance for a chip: "LTI", "120 Mo", "6 Mo" (older scans stored years:
// "10Y" reads "120 Mo"). Unknown phrasing passes through; nothing when there's none.
export function insChip(t) {
  if (!t || t === 'Unknown') return '';
  const m = String(t).match(/^(\d+)\s*([MY])$/i);
  if (!m) return String(t);
  return `${Number(m[1]) * (/y/i.test(m[2]) ? 12 : 1)} Mo`;
}
