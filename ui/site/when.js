// "5:54 PM" today, "Oct 3" before that (beside Scan), and the long form for hover
// text and the ▾ menu ("today, 5:54 PM" / "Oct 3, 2026, 5:54 PM").
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
