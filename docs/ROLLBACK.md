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

1. Branch from the last good tag: `git checkout -b rollback v0.2.12`.
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

Normally the stores get at most one update a day; decide whether a rollback is worth
a second one that day.

## 4. Afterwards

- Turn the kill switch back off once the fixed version is live everywhere.
- Write down what broke and what would have caught it (a test, a canary check), and
  file it as an issue.
