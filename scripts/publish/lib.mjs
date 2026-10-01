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
