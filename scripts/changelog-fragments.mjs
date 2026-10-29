// Changelog fragments: each PR adds one small file to changelog.d/ holding its
// player-facing bullet(s); the release folds them into "## Unreleased" in
// CHANGELOG.md and deletes them (docs/dev/git.md, changelog.d/README.md).
//
//   node scripts/changelog-fragments.mjs [dir]    print the Unreleased section as the
//                                                 release would fold it (changes nothing)
//
// Order: by the number the file name starts with (the PR number), smallest first; the
// same number, or none, sorts by file name. Bullets already under Unreleased come first.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DIR = 'changelog.d';
export const PREFIX = /^- (New|Improved|Changed|Fixed):/;

// → [{ name, bullets: ['- Fixed: …'] }] in fold order. Throws on a bad fragment.
export function readFragments(dir = DIR) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const frags = names
    .filter((n) => n.endsWith('.md') && n.toLowerCase() !== 'readme.md')
    .map((name) => {
      const text = readFileSync(path.join(dir, name), 'utf8').trim();
      const bullets = text.split(/\n(?=- )/).filter(Boolean);
      const bad = bullets.filter((b) => !PREFIX.test(b));
      if (!bullets.length || bad.length)
        throw new Error(
          `${dir}/${name}: each bullet starts with "- New:", "- Improved:", "- Changed:" or "- Fixed:"`,
        );
      return { name, bullets };
    });
  return frags.sort((a, b) => order(a.name) - order(b.name) || (a.name < b.name ? -1 : 1));
}

function order(name) {
  const m = name.match(/^(\d+)/);
  return m ? Number(m[1]) : Infinity;
}

// Adds the fragments' bullets to the end of the Unreleased section; the rest of the
// log is untouched. Returns the log unchanged when there are no fragments.
export function foldInto(log, frags) {
  const bullets = frags.flatMap((f) => f.bullets);
  if (!bullets.length) return log;
  const start = log.search(/^## Unreleased\s*$/m);
  if (start < 0) throw new Error('no "## Unreleased" section in CHANGELOG.md');
  const head = log.slice(0, start);
  const afterHeading = log.slice(start).replace(/^## Unreleased\s*\n/, '');
  const next = afterHeading.search(/^## /m);
  const body = (next < 0 ? afterHeading : afterHeading.slice(0, next)).trim();
  const rest = next < 0 ? '' : afterHeading.slice(next);
  const joined = [body, ...bullets].filter(Boolean).join('\n');
  return `${head}## Unreleased\n\n${joined}\n\n${rest}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const frags = readFragments(process.argv[2] || DIR);
  const folded = foldInto(readFileSync('CHANGELOG.md', 'utf8'), frags);
  const start = folded.search(/^## Unreleased\s*$/m);
  const rest = folded.slice(start + 1);
  const end = rest.search(/^## /m);
  console.log(`${frags.length} fragment(s): ${frags.map((f) => f.name).join(', ') || 'none'}\n`);
  console.log(folded.slice(start, end < 0 ? undefined : start + 1 + end).trimEnd());
}
