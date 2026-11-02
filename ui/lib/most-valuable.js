// Melt Value's "Most Valuable" list (ui/home/ValueCard.svelte): your ship pledges by
// melt value (owner, 2026-11-02: Melt Value everywhere), from OH.hangarValue's per-pledge
// numbers, so nothing new is fetched or priced. Pure.

// Ship pledges with a melt value, biggest melt first, at most `n`: { id, store, paid,
// gain } (`paid` the melt value; `gain` always null, kept for the row's shape).
export function mostValuable(items, hv, n = 3) {
  if (!hv || !hv.pledges) return [];
  const out = [];
  for (const p of items || []) {
    const si = hv.pledges[p.id];
    if (!si || si.ccu) continue;
    const paid = si.paid != null && si.paid > 0 ? si.paid : null;
    if (paid != null) out.push({ id: String(p.id), p, store: si.store, paid, gain: null });
  }
  out.sort((x, y) => y.paid - x.paid || String(x.id).localeCompare(String(y.id)));
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
