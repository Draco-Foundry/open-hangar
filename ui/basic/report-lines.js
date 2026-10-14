// The basic page's words for a scan (ui/scan/runner.js keeps ids and counts only).
// Pure: `t` is ./copy.js's, passed in (test/basic-page.test.js).

// The parts of a scan, as the basic page names them in its progress line and report.
export const PART_NAMES = { hangar: 'Hangar', buybacks: 'Buy-Backs', referrals: 'Referrals' };

// The progress line for the runner's progress ({ part, page, count, retry }), or ''.
export function progressLine(p, t) {
  if (!p || p.part === 'start' || p.part === 'account') return t('basic.scan-start');
  if (p.part === 'referrals') return t('basic.progress-referrals', { n: p.count });
  const part = PART_NAMES[p.part];
  if (!part) return '';
  return p.retry
    ? t('basic.progress-retry', { part, page: p.page, n: p.retry.attempt, of: p.retry.of })
    : t('basic.progress', { part, page: p.page, count: p.count });
}

// The runner's report → the page's { rows: [{ name, ok, text, box? }], signedOut, bad }:
// "Scan complete: 2 pledges · 0 buy-backs · referrals read", and in the problem box each
// row as "{name}: {box ?? text}". A row cut short (partial) counts as a problem. null for
// no report, or one that never ran (held by another page's scan or RSI access).
export function reportLines(report, t) {
  if (!report || report.held === 'busy' || report.held === 'no-rsi') return null;
  const rows = (report.rows || []).map((r) => {
    const name = PART_NAMES[r.id] || r.id;
    if (!r.ok) return { name, ok: false, text: r.error };
    const ok = !r.partial;
    if (r.id === 'hangar') return { name, ok, text: t('basic.row-pledges', { n: r.n }) };
    if (r.id === 'buybacks') return { name, ok, text: t('basic.row-buybacks', { n: r.n }) };
    return { name, ok, text: t('basic.row-referrals'), box: t('basic.row-referrals-box') };
  });
  const bad = rows.filter((r) => !r.ok).length;
  return report.signedOut || bad
    ? { rows, signedOut: !!report.signedOut, bad }
    : { rows, signedOut: false, bad: 0 };
}

// A row for the GitHub issue's summary (Report a Scan Problem): its name and how it went.
export const reportSummary = (lines, signedOut) =>
  (lines?.rows || []).map((r) => `${r.name}: ${r.ok ? 'ok' : 'problem'}`).join(' · ') ||
  (signedOut ? 'signed out of RSI' : 'no scan this session');
