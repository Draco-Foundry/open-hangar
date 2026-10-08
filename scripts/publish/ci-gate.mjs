// Publish gate: waits for the checked-out commit's CI run on GitHub, then exits 0
// if it passed and 1 if it didn't. A release starts publishing right after the tag
// is built, often while CI on the release commit is still running, so this polls
// instead of failing straight away.
//   GH_TOKEN=… node scripts/publish/ci-gate.mjs [--wait=<minutes>]   (default 20; 0 = check once)
import { execFileSync } from 'node:child_process';
import { ciState } from './lib.mjs';

const arg = process.argv.find((a) => a.startsWith('--wait='));
const WAIT_MIN = arg ? Number(arg.slice('--wait='.length)) : 20;
const EVERY_MS = 30e3;
const deadline = Date.now() + Math.max(0, WAIT_MIN) * 60e3;

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const args = ['run', 'list', '--workflow', 'CI', '--commit', sha, '--json', 'status,conclusion'];
if (process.env.GITHUB_REPOSITORY) args.push('-R', process.env.GITHUB_REPOSITORY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (;;) {
  let runs = null;
  try {
    runs = JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }) || '[]');
  } catch (e) {
    console.log(`Couldn't read CI runs (${e.message.split('\n')[0]}); trying again.`);
  }
  const state = runs ? ciState(runs) : 'pending';
  console.log(
    `CI runs for ${sha}: ${runs ? runs.map((r) => `${r.status}/${r.conclusion}`).join(' ') || 'none yet' : '?'} → ${state}`,
  );
  if (state === 'passed') process.exit(0);
  if (state === 'failed') {
    console.log(`::error::CI failed on ${sha}. Fix it (or rerun CI), then publish again.`);
    process.exit(1);
  }
  if (Date.now() + EVERY_MS > deadline) {
    console.log(
      `::error::${sha} has no passing CI run after ${WAIT_MIN} minutes. Check CI on main, then publish again.`,
    );
    process.exit(1);
  }
  await sleep(EVERY_MS);
}
