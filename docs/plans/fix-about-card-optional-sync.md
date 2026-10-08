# fix/about-card-optional-sync

## Goal

Sync is on in every 0.3.0 store build (opt-in by Connect), so the extension's own words
must stop saying there is no server. Help → About and Privacy says plainly what stays in
the browser and what sync sends, and the 0.3.0 privacy policy (`docs/PRIVACY.md` and
`site/privacy.html`) explains the two things it leaves out: the `identity` permission
(Connect's sign-in window) and the website's way in (openhangar.space messaging the
extension for Add to RSI Cart and Connect This Browser; Firefox's site bridge).

## Steps

1. `src/dashboard.html`, Help → About and Privacy: the "no server" bullet becomes the
   owner's sync wording, inside a `sync` flag block (a developer's build without sync
   drops it); the next bullet reads right with or without it.
2. `ui/developers/Developers.svelte`: check it no longer promises an approved-sites API
   or says local-only (#464 fixed it); change nothing unless it still does.
3. `docs/PRIVACY.md` and `site/privacy.html`: a permission note for `identity` and one
   for the messages openhangar.space may send (and Firefox's bridge script). Check the
   synced data list leaves out the prospects list. Same words in both files, nothing
   else changed.
4. Merge `origin/redesign/0.3-svelte`, run the checks, open a draft PR with every added
   or changed legal sentence quoted under "Legal Text Changed".

## Done

- No in-extension text says there is no server or that nothing ever leaves the browser.
- Both policy files list `identity` and the website's way in, in the same words.
- `npm test`, `npm run format:check`, `npm run test:ui`, `npm run pack` and
  `node scripts/check-store-build.mjs` pass; a `--flag sync=off` build drops the sync
  bullet.
- This file is deleted before the PR is ready.
