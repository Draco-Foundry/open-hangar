// Dated Star Citizen events for countdowns. Only dates RSI has announced;
// add new ones as they're published (buy-back tokens: RSI's yearly schedule).
export const EVENTS: { name: string; date: string; url?: string }[] = [
  { name: 'Buy-back token (Q1)', date: '2026-01-05' },
  { name: 'Buy-back token (Q2)', date: '2026-04-06' },
  { name: 'Buy-back token (Q3)', date: '2026-07-06' },
  { name: 'Buy-back token (Q4)', date: '2026-10-05' },
];

export function upcoming(now = Date.now(), limit = 4) {
  return EVENTS.map((e) => ({ ...e, t: new Date(e.date + 'T12:00:00Z').getTime() }))
    .filter((e) => e.t > now)
    .sort((a, b) => a.t - b.t)
    .slice(0, limit);
}

export function countdown(t: number, now = Date.now()) {
  const days = Math.ceil((t - now) / 86400e3);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}
