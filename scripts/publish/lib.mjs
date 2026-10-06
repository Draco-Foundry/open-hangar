// The decisions the Publish to stores workflow makes, kept out of inline YAML so
// `npm test` covers them (test/publish.test.js). The CLIs next to this file call
// these; the workflow only calls the CLIs.

// `runs` is `gh run list --json status,conclusion` for the commit being published.
// True when at least one CI run on that commit finished green.
export function ciPassed(runs) {
  return (
    Array.isArray(runs) && runs.some((r) => r.status === 'completed' && r.conclusion === 'success')
  );
}

// Where CI stands on the commit, for the publish job's wait (ci-gate.mjs):
//   passed   a run finished green
//   pending  no run yet, or one is queued / running: keep waiting
//   failed   every run finished and none of them green: stop waiting
export function ciState(runs) {
  if (ciPassed(runs)) return 'passed';
  if (!Array.isArray(runs) || !runs.length) return 'pending';
  return runs.some((r) => r.status !== 'completed') ? 'pending' : 'failed';
}

// "v0.2.13" or "0.2.13" against manifest.json's version.
export function tagMatches(tag, version) {
  return typeof tag === 'string' && tag.replace(/^v/, '') === version;
}

// What a Chrome Web Store upload's output means. `code` is the CLI's exit code.
//   ok      uploaded and sent for review
//   waiting the previous version is still in review (or approved but not yet
//           published), so Google won't take a new one yet: not a failure, rerun
//           with store: chrome once it clears
//   failed  anything else
export function chromeOutcome(output, code) {
  const text = String(output || '');
  if (/ITEM_NOT_UPDATABLE/.test(text)) return 'waiting';
  if (code === 0 && !/uploadState:\s*'FAILURE'/.test(text)) return 'ok';
  return 'failed';
}

// The run name publish.yml gives a manual run (`run-name`), e.g.
// "Publish v0.2.13 to all" or "Publish v0.2.13 to chrome (dry run)".
// → { tag, store, dry }, or null for a name it didn't write (runs from before #183).
export function parseRunName(name) {
  const m = /^Publish (\S+) to (\w+)( \(dry run\))?$/.exec(String(name || ''));
  return m ? { tag: m[1], store: m[2], dry: Boolean(m[3]) } : null;
}

const bare = (tag) => String(tag || '').replace(/^v/, '');

// The owner's rule: at most one store update a day (#183). `runs` are this
// workflow's other manual runs from the last 24 hours, each
// { name, conclusion, uploaded } where `uploaded` says a store job of a failed run
// still went through. Returns null when this run may upload, or why it may not.
//   - store: discord uploads nothing, so it's never held back.
//   - A run that uploaded counts: success, or a failure that got some store through.
//     Dry runs and Discord-only runs don't.
//   - Finishing the same tag with one store (store: chrome after Chrome said "still
//     in review", say) is fine: it's still today's release.
//   - `allow` (the hotfix box) lets a second update through anyway.
export function dailyGate({ runs, tag, store, allow }) {
  if (allow || store === 'discord') return null;
  for (const run of runs || []) {
    const info = parseRunName(run.name);
    if (info && (info.dry || info.store === 'discord')) continue;
    if (run.conclusion !== 'success' && !run.uploaded) continue;
    if (info && store !== 'all' && bare(info.tag) === bare(tag)) continue;
    return info
      ? `${info.tag} (store: ${info.store}) went to the stores less than 24 hours ago`
      : `"${run.name}" published less than 24 hours ago (its tag is unknown)`;
  }
  return null;
}

// ---- Store versions on openhangar.space/extension (store-versions.mjs) --------

// The version in a Chrome or Edge update check reply (the same XML the browsers
// read to update extensions), or null.
export function updateCheckVersion(xml) {
  const m = /<updatecheck\b[^>]*\bversion="(\d+(?:\.\d+){0,3})"/.exec(String(xml || ''));
  return m ? m[1] : null;
}

// The version in Edge Add-ons' product details for a listing (JSON, the page's
// own data), or null. The fallback when Edge's update check doesn't answer.
export function edgeDetailsVersion(json) {
  let v;
  try {
    v = JSON.parse(String(json || '')).version;
  } catch {
    return null;
  }
  return typeof v === 'string' && /^\d+(?:\.\d+){0,3}$/.test(v) ? v : null;
}

// True when version a is newer than b ("0.2.10" > "0.2.9"). A missing b counts
// as older; a missing a never wins.
export function versionNewer(a, b) {
  if (!a) return false;
  if (!b) return true;
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

// What each store was last sent, from Publish to stores runs. `runs` is
// [{ title: 'Publish v0.2.13 to all', jobs: [{ name, conclusion, notes: [] }] }],
// notes being the job's annotation messages. Dry runs are skipped by their title;
// a green job whose notes say nothing went out (Chrome still reviewing the last
// version, missing secrets) doesn't count. Returns { chrome: '0.2.13', ... }.
export function submittedVersions(runs) {
  const out = {};
  for (const r of runs || []) {
    const m = /^Publish v(\d+(?:\.\d+)*) to (all|chrome|edge|firefox)$/.exec(r.title || '');
    if (!m) continue;
    for (const j of r.jobs || []) {
      if (!['chrome', 'edge', 'firefox'].includes(j.name) || j.conclusion !== 'success') continue;
      if ((j.notes || []).some((n) => /not sent|still reviewing|skipped|dry run/i.test(n)))
        continue;
      if (versionNewer(m[1], out[j.name])) out[j.name] = m[1];
    }
  }
  return out;
}

// One store's line: the live version, and a newer submitted one as pending.
export function storeLine(live, submitted) {
  return {
    live: live || null,
    pending: live && versionNewer(submitted, live) ? submitted : null,
  };
}

// Fills each install button's version spans in the landing page:
//   <span class="b-ver" data-ver="chrome"></span>
//   <span class="b-pend" data-pend="chrome"></span>
// Empty spans stay empty (and hidden), so a store we couldn't read shows nothing.
export function stampStoreVersions(html, lines) {
  let out = String(html);
  for (const [store, { live, pending }] of Object.entries(lines || {})) {
    out = out
      .replace(
        new RegExp(`(<span class="b-ver" data-ver="${store}">)[^<]*(</span\\s*>)`),
        `$1${live ? `v${live}` : ''}$2`,
      )
      .replace(
        new RegExp(`(<span class="b-pend" data-pend="${store}">)[^<]*(</span\\s*>)`),
        `$1${pending ? `v${pending} in review` : ''}$2`,
      );
  }
  return out;
}

// The same facts as a small public JSON file (openhangar.space/versions.json), for
// pages that aren't stamped at deploy (the website's /extension page reads it).
export function versionsJson({ version, updated, lines, checkedAt }) {
  return {
    version: version || null,
    updated: updated || null,
    stores: Object.fromEntries(
      ['chrome', 'edge', 'firefox'].map((s) => [
        s,
        { live: lines?.[s]?.live ?? null, pending: lines?.[s]?.pending ?? null },
      ]),
    ),
    checkedAt,
  };
}
