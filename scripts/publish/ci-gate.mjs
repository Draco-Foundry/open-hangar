// Publish gate: exits 1 unless the checked-out commit has a green CI run on GitHub.
//   GH_TOKEN=… node scripts/publish/ci-gate.mjs
import { execFileSync } from 'node:child_process';
import { ciPassed } from './lib.mjs';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const args = ['run', 'list', '--workflow', 'CI', '--commit', sha, '--json', 'status,conclusion'];
if (process.env.GITHUB_REPOSITORY) args.push('-R', process.env.GITHUB_REPOSITORY);
const runs = JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }) || '[]');

console.log(
  `CI runs for ${sha}: ${runs.map((r) => `${r.status}/${r.conclusion}`).join(' ') || 'none'}`,
);
if (!ciPassed(runs)) {
  console.log(
    `::error::${sha} has no passing CI run yet. Wait for CI on main (or rerun it), then publish.`,
  );
  process.exit(1);
}
