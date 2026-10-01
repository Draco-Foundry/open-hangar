# Rolling Back a Bad Release

A version is out and it's broken. The stores can't simply "go back": each one
handles it differently, and most of the time the fix is to ship the last good code
again under a **higher** version number. Do these in order.

## 1. Stop the Damage (Minutes)

- If a scan is broken, pause it with the kill switch: edit `site/status.json`
  (docs/RSI-CHANGES.md, step 0). Paused scans never change saved data.
- Pin a short note in Discord #help and #announcements: what's wrong, that a fix is
  on the way, and that their data is safe.

## 2. Find the Last Good Version

Every release's exact store packages are on the
[GitHub Releases](https://github.com/Draco-Foundry/open-hangar/releases) page:
`open-hangar-chrome-<version>.zip` (Chrome and Edge) and
`open-hangar-firefox-<version>.zip`. The tag `v<version>` is the code that built them.

## 3. Roll Back Each Store

Chrome and Edge only install a version **higher** than the one users have, so
"rolling back" there means shipping the old code again as a new patch version.

1. Branch from the last good tag: `git checkout -b rollback v0.2.12`. Saved data
   survives the trip: an older version simply ignores what it doesn't know (after
   0.2.12 the scan history moved to its own storage key), and on the next upgrade
   anything it wrote is merged back in (`test/db.test.js`, "after a rollback").
2. Bump the patch version past the bad one (bad 0.2.13 → ship 0.2.14) in
   `manifest.json` and `package.json`, and add a CHANGELOG entry
   ("Fixed: undid 0.2.13's … while we fix it").
3. Merge it to `main` through a PR (Publish only takes a commit that passed CI), tag
   it and let the Release workflow build it, then run **Publish to stores**.

Per store:

- **Chrome Web Store:** if the item's Package tab offers a rollback to the previous
  version, that's fastest; otherwise ship the bumped version above. In the
  submission notes say it reverts a broken update. Reviews of small fixes are usually
  quick.
- **Edge Add-ons:** no rollback; ship the bumped version. Same note in the
  certification notes.
- **Firefox (AMO):** in the Developer Hub, **Manage Status & Versions** → disable the
  bad version. New installs then get the previous version right away; people who
  already updated keep the bad one until the bumped version is approved, so ship it
  too.

Normally the stores get at most one update a day, and Publish to stores enforces it: a
real run fails if another one sent something to the stores in the last 24 hours. If
the rollback is worth a second update that day, tick **Hotfix: allow a second store
update within 24h** when you run it. Finishing the same tag one store at a time (say
store: chrome after Chrome was still reviewing the last version) doesn't need the box.

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
   percentage go back down), and ship the fix as in step 3 above.

## 4. Afterwards

- Turn the kill switch back off once the fixed version is live everywhere.
- Write down what broke and what would have caught it (a test, a canary check), and
  file it as an issue.
