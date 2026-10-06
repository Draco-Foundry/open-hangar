// One-command release (backend foundation step 1, in the private website plan):
//
//   npm run release 0.2.12            cut the release and push it
//   npm run release 0.2.12 --dry-run  show what would happen, change nothing
//   npm run release 0.2.12 --hotfix   a second store update within 24 hours
//
// On main, with a clean tree: checks the version is newer and every Unreleased bullet
// starts with New:, Improved:, Changed: or Fixed:; runs the tests; moves "## Unreleased"
// in CHANGELOG.md under "## <version> — <today>"; bumps manifest.json and package.json;
// commits, tags v<version> and pushes. The tag builds the GitHub Release, which then
// starts Actions → Publish to stores (store: all) by itself: that waits for CI on the
// release commit, then for your Approve on the 'stores' environment, uploads, and
// posts to Discord #updates. --hotfix marks the tag so that run may be the second
// store update today (the Hotfix box).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry-run');
const hotfix = args.includes('--hotfix');
// With stdio: 'inherit' execSync returns null (the output went to the terminal).
const run = (cmd, opts = {}) =>
  (execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }) ?? '').trim();
const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

if (!version || !/^\d+\.\d+\.\d+$/.test(version))
  fail('usage: npm run release <x.y.z> [--dry-run] [--hotfix]');

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
  console.log('  Then GitHub builds the release and starts publishing to every store');
  console.log(
    `  (${hotfix ? 'as a hotfix: a second update today is allowed' : 'one store update a day'}).`,
  );
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
// "[hotfix]" in the tag's message ticks the Hotfix box on the publish run that
// release.yml starts (a second store update within 24 hours).
run(`git tag -a v${version} -m "Open Hangar ${version}${hotfix ? ' [hotfix]' : ''}"`);
// Pushes retry: a push can hit a one-off network hiccup (seen with 0.2.12).
const push = (ref) => {
  for (let i = 1; ; i++) {
    try {
      return run(`git push origin ${ref}`, { stdio: 'inherit' });
    } catch {
      if (i === 3) fail(`couldn't push ${ref}: run "git push origin ${ref}" by hand`);
      console.log(`Push of ${ref} failed, retrying (${i}/2)…`);
    }
  }
};
push('main');
push(`v${version}`);
console.log(`\n✔ Released v${version}. The GitHub Release is building now.`);
console.log(`
  Publishing to the stores starts by itself once the release is built
  (store: all${hotfix ? ', hotfix' : ''}). It waits for CI on the release commit, then for you:
    1. Open https://github.com/Draco-Foundry/open-hangar/actions/workflows/publish.yml
    2. Open the run "Publish v${version} to all"
    3. Review deployments → stores → Approve and deploy
  Nothing started after ~5 minutes? Run that workflow by hand: tag v${version}, store: all.`);
