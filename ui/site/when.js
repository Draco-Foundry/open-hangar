// "5:54 PM" today, "Oct 3" before that (beside Scan), and the long form for hover
// text and the ▾ menu ("today, 5:54 PM" / "Oct 3, 2026, 5:54 PM").
// A time ahead, for "try again at ...": "6:02 PM" today, "Oct 12, 6:02 PM" after.
export function at(t) {
  if (!t) return '';
  const d = new Date(t);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}
export function synced(t) {
  if (!t) return null;
  const at = new Date(t);
  const today = at.toDateString() === new Date().toDateString();
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return {
    short: today ? time : at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    long: `${today ? 'today' : at.toLocaleDateString(undefined, { dateStyle: 'medium' })}, ${time}`,
  };
}
