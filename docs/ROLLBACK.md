# Rolling Back a Bad Release

Rolling back is the maintainer's job. The stores can't simply go back, so the fix is
usually the last good code shipped again under a higher version number. The
step-by-step for each store is kept in the maintainer's private notes. While a fix is
on its way, a broken scan can be paused for everyone with `site/status.json`
(docs/RSI-CHANGES.md, step 0).

## Staged Rollout (Chrome, Later)

Chrome sends an approved update to 100% of users at once (`--auto-publish` in
`scripts/publish/chrome.mjs`). The Chrome Web Store only offers a partial rollout
(`deployPercentage`) to items with **10,000+ users**, and Open Hangar is well below
that, so there's nothing to set yet. Once it passes 10,000 users:

1. In `scripts/publish/chrome.mjs`, upload without `--auto-publish`, then publish
   with a `deployPercentage` of 10.
2. Add a way to raise it to 100 (a `store: chrome-100` choice or a small script)
   after a day of clean reports.
3. A bad version then only reaches 10%: don't raise it (Google doesn't let the
   percentage go back down), and ship the fix as a new version.
