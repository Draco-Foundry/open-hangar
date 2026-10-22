// Warns (never fails) when a PR changes src/, ui/popup/ or ui/basic/ but adds no changelog
// fragment. CI hands it
// the PR's files from the GitHub API (.github/workflows/ci.yml):
//   node scripts/check-changelog-fragment.mjs <files.json>
// A warning is an annotation on the run plus a line in its summary; the exit code is 0
// either way, because plenty of src/ changes (refactors, internals) have no player line.
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function needsFragment(filenames) {
  const touchesSrc = filenames.some(
    (f) => f.startsWith('src/') || f.startsWith('ui/popup/') || f.startsWith('ui/basic/'),
  );
  const hasFragment = filenames.some(
    (f) => /^changelog\.d\/[^/]+\.md$/.test(f) && f.toLowerCase() !== 'changelog.d/readme.md',
  );
  return touchesSrc && !hasFragment;
}

export const MESSAGE =
  'This PR changes src/, ui/popup/ or ui/basic/ but adds no changelog fragment. If players will notice, add ' +
  'changelog.d/<PR number>-<slug>.md with a New:/Improved:/Changed:/Fixed: bullet ' +
  '(changelog.d/README.md); if not, ignore this.';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: check-changelog-fragment.mjs <files.json>');
    process.exit(2);
  }
  const text = readFileSync(file, 'utf8').trim();
  let pages;
  try {
    pages = JSON.parse(text).flat();
  } catch {
    pages = JSON.parse(`[${text.replace(/\]\s*\[/g, '],[')}]`).flat();
  }
  if (needsFragment(pages.map((f) => f.filename))) {
    console.log(`::warning title=No changelog fragment::${MESSAGE}`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**No changelog fragment.** ${MESSAGE}\n`);
  } else {
    console.log('check-changelog-fragment: ok');
  }
}
