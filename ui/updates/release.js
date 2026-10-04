// Release-notes helpers for the Updates page (moved from src/dashboard.js).

// "2026-09-28" → "Sep 28, 2026"; anything else (e.g. "June 2026") as written.
export const releaseDate = (d) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : d;

// Split a release's bullets into New / Improved / Fixed by their CHANGELOG
// prefix ("New:", "Improved:", "Changed:", "Fixed:"). Untagged bullets count
// as Improved. The prefix is stripped and the rest starts with a capital.
const RELEASE_TAG = /^(\*\*)?(new|improved|changed|fix(?:ed)?)\b\s*:?\s*/i;
const releaseKind = (t) => {
  const tag = (t.match(RELEASE_TAG)?.[2] || '').toLowerCase();
  return tag === 'new' ? 'new' : tag.startsWith('fix') ? 'fixed' : 'improved';
};
const capFirst = (t) => String(t || '').replace(/^\w/, (c) => c.toUpperCase());
const GROUPS = [
  ['new', 'New'],
  ['improved', 'Improved'],
  ['fixed', 'Fixed'],
];
export const releaseGroups = (items) =>
  GROUPS.map(([key, label]) => ({
    key,
    label,
    items: items
      .filter((t) => releaseKind(t) === key)
      .map((t) => capFirst(t.replace(RELEASE_TAG, '$1'))),
  })).filter((g) => g.items.length);

// The little markdown CHANGELOG lines use (**bold**, `code`, [links](https://…)),
// as parts for Markdown.svelte to draw: same rules as OH.inlineMarkdown in
// src/lib.js, without building an HTML string.
//   → [{ t: 'text' | 'strong' | 'code' | 'a', text, href?, parts? }]
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)"&<>']+)\)/g;
function links(text) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > at) out.push({ t: 'text', text: text.slice(at, m.index) });
    out.push({ t: 'a', text: m[1], href: m[2] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ t: 'text', text: text.slice(at) });
  return out;
}
function split(text, re, kind, inner) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push(...inner(text.slice(at, m.index)));
    out.push({ t: kind, parts: inner(m[1]) });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(...inner(text.slice(at)));
  return out;
}
const codeAndLinks = (text) => split(text, /`([^`]+)`/g, 'code', links);
export const inlineParts = (text) =>
  split(String(text || ''), /\*\*(.+?)\*\*/g, 'strong', codeAndLinks);
