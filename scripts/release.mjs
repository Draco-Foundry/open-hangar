// One-command release (docs/WEBSITE-PLAN.md → backend foundation, step 1):
//
//   npm run release 0.2.12            cut the release and push it
//   npm run release 0.2.12 --dry-run  show what would happen, change nothing
//
// On main, with a clean tree: checks the version is newer and every Unreleased bullet
// starts with New:, Improved:, Changed: or Fixed:; runs the tests; moves "## Unreleased"
// in CHANGELOG.md under "## <version> — <today>"; bumps manifest.json and package.json;
// commits, tags v<version> and pushes. The tag builds the GitHub Release; then run
// Actions → Publish to stores (store: all), which also posts to Discord #updates.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry-run');
// With stdio: 'inherit' execSync returns null (the output went to the terminal).
const run = (cmd, opts = {}) =>
  (execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }) ?? '').trim();
const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

if (!version || !/^\d+\.\d+\.\d+$/.test(version))
  fail('usage: npm run release <x.y.z> [--dry-run]');

// Where we are.
const branch = run('git branch --show-current');
if (branch !== 'main' && !dry) fail(`releases come from main (you're on ${branch})`);
if (run('git status --porcelain') && !dry) fail('commit or stash your changes first');

// Version must go up.
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const cmp = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
if (cmp(version, manifest.version) <= 0) fail(`${version} isn't newer than ${manifest.version}`);
if (run(`git tag -l v${version}`)) fail(`tag v${version} already exists`);

// Changelog: the Unreleased section becomes this version.
const log = fs.readFileSync('CHANGELOG.md', 'utf8');
const start = log.search(/^## Unreleased\s*$/m);
if (start < 0) fail('no "## Unreleased" section in CHANGELOG.md');
const after = log.slice(start).replace(/^## Unreleased\s*\n/, '');
const next = after.search(/^## /m);
const body = (next < 0 ? after : after.slice(0, next)).trim();
if (!body) fail('"## Unreleased" is empty: nothing to release');
const bullets = body.split(/\n(?=- )/).filter((b) => b.startsWith('- '));
const bad = bullets.filter((b) => !/^- (New|Improved|Changed|Fixed):/.test(b));
if (bad.length)
  fail(
    `bullets without New:/Improved:/Changed:/Fixed:\n  ${bad.map((b) => b.split('\n')[0]).join('\n  ')}`,
  );
const count = (k) => bullets.filter((b) => b.startsWith(`- ${k}:`)).length;

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const newLog =
  log.slice(0, start) +
  `## Unreleased\n\n## ${version} — ${today}\n\n${body}\n\n` +
  (next < 0 ? '' : after.slice(next));

console.log(`Open Hangar ${manifest.version} → ${version} (${today})`);
console.log(
  `  ${bullets.length} changes: ${count('New')} new, ${count('Improved')} improved, ${count('Changed')} changed, ${count('Fixed')} fixed`,
);
if (dry) {
  console.log('\nDry run: nothing changed. Without --dry-run this would:');
  console.log('  run the tests, update CHANGELOG.md / manifest.json / package.json,');
  console.log(`  commit "release: ${version}", tag v${version} and push both.`);
  process.exit(0);
}

console.log('Running the tests…');
try {
  run('npm test', { stdio: 'inherit' });
} catch {
  fail('tests failed: nothing was changed');
}

fs.writeFileSync('CHANGELOG.md', newLog);
for (const f of ['manifest.json', 'package.json']) {
  const s = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
}
run('npx prettier --write CHANGELOG.md manifest.json package.json');
run('git add CHANGELOG.md manifest.json package.json');
run(`git commit -m "release: ${version}"`);
run(`git tag -a v${version} -m "Open Hangar ${version}"`);
run('git push origin main', { stdio: 'inherit' });
run(`git push origin v${version}`, { stdio: 'inherit' });
console.log(`\n✔ Released v${version}. The GitHub Release is building now.`);
console.log(
  '  Next: Actions → Publish to stores → Run workflow (tag v' + version + ', store: all).',
);
