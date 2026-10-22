// Parser version check: a PR that changes how RSI's pages are read (PARSER_FILES)
// also bumps PARSER_VERSION in src/hangar-shape.js, so data saved by the old parser
// shows as stale instead of current. Unless a commit in the PR says why the parsed
// data doesn't change, with a trailer line:
//
//   Parser-Version-Unchanged: adds a report only, parsed output is the same
//
// CI (.github/workflows/ci.yml) hands it the PR's files and commits from the GitHub
// API; locally it reads git:
//   node scripts/check-parser-version.mjs --pr <files.json> <commits.json>
//   node scripts/check-parser-version.mjs --git origin/main
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PARSER_FILES = [
  'src/scraper/parser.js',
  'src/parser-rules.js',
  'src/data/parser-rules.json',
];
export const VERSION_FILE = 'src/hangar-shape.js';
export const TRAILER = /^Parser-Version-Unchanged:[ \t]*(\S.*)$/m;
const BUMP = /^\+\s*const PARSER_VERSION = \d+;/m;

// files: [{ filename, patch }], messages: [commit message] → { ok, why }.
export function verdict({ files, messages }) {
  const changed = files.filter((f) => PARSER_FILES.includes(f.filename)).map((f) => f.filename);
  if (!changed.length) return { ok: true, why: 'no parser change' };
  const version = files.find((f) => f.filename === VERSION_FILE);
  if (version && BUMP.test(version.patch || '')) return { ok: true, why: 'PARSER_VERSION bumped' };
  for (const m of messages) {
    const t = String(m).match(TRAILER);
    if (t) return { ok: true, why: `Parser-Version-Unchanged: ${t[1].trim()}` };
  }
  return {
    ok: false,
    why:
      `${changed.join(', ')} changed, but PARSER_VERSION in ${VERSION_FILE} didn't. ` +
      'Bump it, or add a commit with the trailer "Parser-Version-Unchanged: <why the parsed ' +
      'data stays the same>".',
  };
}

// `gh api --paginate` output: one array, pages of arrays (--slurp), or arrays back to back.
export function readPages(text) {
  const t = String(text).trim();
  try {
    return JSON.parse(t).flat();
  } catch {
    return JSON.parse(`[${t.replace(/\]\s*\[/g, '],[')}]`).flat();
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, a, b] = process.argv.slice(2);
  let input;
  if (mode === '--pr' && a && b) {
    input = {
      files: readPages(readFileSync(a, 'utf8')),
      messages: readPages(readFileSync(b, 'utf8')).map((c) => c.commit?.message || ''),
    };
  } else if (mode === '--git' && a) {
    const names = git(['diff', '--name-only', `${a}...HEAD`])
      .split('\n')
      .filter(Boolean);
    input = {
      files: names.map((filename) => ({
        filename,
        patch: filename === VERSION_FILE ? git(['diff', `${a}...HEAD`, '--', filename]) : '',
      })),
      messages: git(['log', '--format=%B%x00', `${a}..HEAD`]).split('\0'),
    };
  } else {
    console.error(
      'usage: check-parser-version.mjs --pr <files.json> <commits.json> | --git <base>',
    );
    process.exit(2);
  }
  const { ok, why } = verdict(input);
  console[ok ? 'log' : 'error'](`check-parser-version: ${why}`);
  process.exit(ok ? 0 : 1);
}
