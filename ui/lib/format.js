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
// "today" / "yesterday" / "13 days ago", counted in calendar days (not 24h blocks).
export function daysAgo(t, now = Date.now()) {
  const day = (x) => {
    const d = new Date(x);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const n = Math.round((day(now) - day(t)) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}
// A date-only value ("2026-09-16", stored as UTC midnight) shown as that same day,
// not shifted into the day before by the local time zone.
export const shortDateUTC = (t) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
// Calendar days since a date-only value (UTC midnight), from the viewer's local today.
export function daysAgoUTC(t, now = Date.now()) {
  const d = new Date(now);
  const n = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - t) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}
