// Numbers that never break a layout: counts exact under 1,000, then "1.2K" /
// "10.5K" / "1.2M". Money shortening lives in the app (OHApp.bigMoney) because it
// depends on the chosen currency.
const nf = new Intl.NumberFormat('en-US');
export const exactCount = (n) => nf.format(n);
export function shortCount(n) {
  const a = Math.abs(n);
  const trim = (x) => String(Math.round(x * 10) / 10).replace(/\.0$/, '');
  if (a < 1000) return nf.format(n);
  if (a < 1e6) return trim(n / 1000) + 'K';
  return trim(n / 1e6) + 'M';
}
export const plural = (n, one, many) => (n === 1 ? one : many);

// "today" / "tomorrow" / "in 5 days" until a timestamp.
export function daysUntil(t, now = Date.now()) {
  const d = Math.ceil((t - now) / 86400e3);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
}
// "Oct 5" this year, "Mar 16, 2025" otherwise (older dates must not look newer).
export function shortDay(t) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
  });
}
export const monthName = (t) => new Date(t).toLocaleDateString(undefined, { month: 'long' });
export const wikiUrl = (page) =>
  `https://starcitizen.tools/${encodeURIComponent(String(page).replace(/ /g, '_'))}`;
