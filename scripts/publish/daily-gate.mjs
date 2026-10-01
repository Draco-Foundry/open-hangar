// One store update a day: exits 1 if another real run of Publish to stores sent
// something to the stores in the last 24 hours (rules in lib.mjs, dailyGate).
//   GH_TOKEN=… TAG=v0.2.13 STORE=all ALLOW=false node scripts/publish/daily-gate.mjs
// ALLOW=true is the workflow's "Hotfix: allow a second store update within 24h" box.
import { execFileSync } from 'node:child_process';
import { dailyGate } from './lib.mjs';

const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: self, TAG: tag, STORE: store } = process.env;
const allow = process.env.ALLOW === 'true';
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');

const api = (route, params = {}) =>
  JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        '-X',
        'GET',
        route,
        ...Object.entries(params).flatMap(([k, v]) => ['-f', `${k}=${v}`]),
      ],
      { encoding: 'utf8' },
    ),
  );

const { workflow_runs: found = [] } = api(`repos/${repo}/actions/workflows/publish.yml/runs`, {
  event: 'workflow_dispatch',
  status: 'completed',
  created: `>=${since}`,
  per_page: 100,
});
const runs = found
  .filter((r) => String(r.id) !== String(self))
  .map((r) => {
    let uploaded = false;
    // A failed run may still have got a store through: look at its upload jobs.
    if (r.conclusion !== 'success') {
      const { jobs = [] } = api(`repos/${repo}/actions/runs/${r.id}/jobs`, { filter: 'latest' });
      uploaded = jobs.some(
        (j) => ['firefox', 'edge', 'chrome'].includes(j.name) && j.conclusion === 'success',
      );
    }
    return { name: r.display_title, conclusion: r.conclusion, uploaded };
  });

console.log(
  `Publish runs since ${since}: ${runs.map((r) => `"${r.name}" ${r.conclusion}`).join(', ') || 'none'}`,
);
const why = dailyGate({ runs, tag, store, allow });
if (why) {
  console.log(
    `::error::One store update a day: ${why}. If this is a hotfix that can't wait, ` +
      "run it again with 'Hotfix: allow a second store update within 24h' ticked.",
  );
  process.exit(1);
}
if (allow) console.log('::notice::Hotfix: the one-a-day check was skipped on purpose.');
