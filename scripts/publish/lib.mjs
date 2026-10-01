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
