// Stamps each store's live version, and a newer one waiting in review, onto the
// install buttons of openhangar.space/extension (rules in lib.mjs), and writes the
// same facts plus the latest version as versions.json beside it. Run at deploy
// and daily by .github/workflows/pages.yml:
//   GH_TOKEN=… GITHUB_REPOSITORY=Draco-Foundry/open-hangar node scripts/publish/store-versions.mjs site/index.html
// Live versions come from the stores' public update checks (what browsers ask;
// Edge Add-ons' listing details when Edge's doesn't answer) and the Firefox
// add-ons API: one request each, one at a time, with an honest User-Agent.
// "In review" = the newest version our Publish runs actually sent to that
// store, when it's newer than the live one. Anything that can't be read
// is left blank, never guessed; the page then just shows the buttons.
// "Arriving" = a store we hold back on purpose, from site/store-plan.json beside
// the page (docs/STORE.md "Holding a Store Back"): shown until that store has the
// version, it goes to review, or the planned UTC day is over.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  edgeDetailsVersion,
  readStorePlan,
  stampStoreVersions,
  storeLine,
  submittedVersions,
  updateCheckVersion,
  versionsJson,
} from './lib.mjs';

const file = process.argv[2] || 'site/index.html';
const repo = process.env.GITHUB_REPOSITORY || 'Draco-Foundry/open-hangar';
const UA = 'OpenHangarSite/1.0 (+https://openhangar.space; version check once a day)';
const CHROME_ID = 'aeabioadfphghjennmdbnpelojlhndjl';
const EDGE_ID = 'fmcnemfepnifokjelgjacgdhoodaiicl';
const AMO_SLUG = 'open-hangar';
const updateCheck = (base, id) =>
  `${base}?response=updatecheck&acceptformat=crx3&prodversion=140.0&x=${encodeURIComponent(`id=${id}&uc`)}`;

async function get(url) {
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      console.log(`::notice::${new URL(url).host} answered ${r.status}`);
      return null;
    }
    return await r.text();
  } catch (e) {
    console.log(`::notice::${new URL(url).host}: ${e.message}`);
    return null;
  }
}

const live = {
  chrome: updateCheckVersion(
    await get(updateCheck('https://clients2.google.com/service/update2/crx', CHROME_ID)),
  ),
  edge: updateCheckVersion(
    await get(updateCheck('https://edge.microsoft.com/extensionwebstorebase/v1/crx', EDGE_ID)),
  ),
  firefox: null,
};
// Edge's update check sometimes answers 500; then ask Edge Add-ons for the
// listing's details instead (one more request, only when needed).
if (!live.edge) {
  live.edge = edgeDetailsVersion(
    await get(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${EDGE_ID}`),
  );
}
try {
  const amo = await get(`https://addons.mozilla.org/api/v5/addons/addon/${AMO_SLUG}/`);
  live.firefox = amo ? JSON.parse(amo).current_version?.version || null : null;
} catch {
  live.firefox = null;
}

// What our own Publish runs sent each store (needs GH_TOKEN with actions: read).
let submitted = {};
try {
  const api = (route) =>
    JSON.parse(execFileSync('gh', ['api', '-X', 'GET', route], { encoding: 'utf8' }));
  const { workflow_runs: found = [] } = api(
    `repos/${repo}/actions/workflows/publish.yml/runs?event=workflow_dispatch&status=completed&per_page=30`,
  );
  const runs = found
    .filter((r) => /^Publish v[\d.]+ to (all|chrome|edge|firefox)$/.test(r.display_title))
    .map((r) => ({
      title: r.display_title,
      jobs: (api(`repos/${repo}/actions/runs/${r.id}/jobs?filter=latest`).jobs || []).map((j) => ({
        name: j.name,
        conclusion: j.conclusion,
        notes: ['chrome', 'edge', 'firefox'].includes(j.name)
          ? api(`repos/${repo}/check-runs/${j.id}/annotations`).map((a) => a.message || '')
          : [],
      })),
    }));
  submitted = submittedVersions(runs);
} catch (e) {
  console.log(`::notice::Publish runs not read, so no "in review" lines: ${e.message}`);
}

// Stores held back on purpose (hand-edited; missing or broken = no plan).
let plan = {};
try {
  const planFile = path.join(path.dirname(file), 'store-plan.json');
  if (fs.existsSync(planFile)) plan = readStorePlan(JSON.parse(fs.readFileSync(planFile, 'utf8')));
} catch (e) {
  console.log(`::warning::site/store-plan.json not read, so no "arriving" lines: ${e.message}`);
}

const today = new Date().toISOString().slice(0, 10); // UTC day
const lines = Object.fromEntries(
  ['chrome', 'edge', 'firefox'].map((s) => [s, storeLine(live[s], submitted[s], plan[s], today)]),
);
fs.writeFileSync(file, stampStoreVersions(fs.readFileSync(file, 'utf8'), lines));
// The same, plus the latest version and its date, as versions.json next to the page.
let updated = null;
try {
  updated =
    execFileSync('git', ['log', '-1', '--format=%cs', '-G"version"', '--', 'manifest.json'], {
      encoding: 'utf8',
    }).trim() || null;
} catch {
  // A shallow checkout: the date stays empty.
}
const version = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version;
fs.writeFileSync(
  path.join(path.dirname(file), 'versions.json'),
  JSON.stringify(
    versionsJson({ version, updated, lines, checkedAt: new Date().toISOString() }),
    null,
    2,
  ) + '\n',
);
for (const [s, l] of Object.entries(lines))
  console.log(
    `${s}: live ${l.live || '?'}${l.pending ? `, ${l.pending} in review` : ''}${
      l.arriving ? `, ${l.arriving.version} arriving ${l.arriving.on}` : ''
    }`,
  );
