# feat/bridge-v2

## Goal

The website's way in to the extension, version 2: each of our pages gets its own short
list of requests, every message is checked before anything runs, the hello says what
this build answers for that page, and the Firefox bridge does nothing anywhere but our
own pages. Our own hangar page (hangar.openhangar.space, Local Mode) can read the
hangar this browser scanned, see how fresh it is and ask for a scan, behind a new
`localMode` build flag (off in the store build and the beta until the privacy policy
names the hangar page; on in the staging developer build).

## Steps

1. `localMode` in `src/flags.js` (default off, beta off until the privacy policy names
   the hangar page, not dev-only; a test fails while a store or beta build lets in a
   page the policy doesn't name). `npm run build:staging` turns it on.
2. `src/site-pages.js`: the page lists (hangar pages, site pages, the pages that may
   Connect), written per build by `scripts/pack.mjs` into the built copy; the
   capabilities and their message types; which page may ask what; and the inbound
   check (a plain object, 16 KB at most, a known type for this page, only that type's
   keys with the right types). Wrong page and unknown type get the same answer.
3. `src/background.js`: every message goes through that check; hello v2 (`v`,
   `version`, `caps`, plus `cart` and `connect` for older pages); the Firefox path
   re-checks the sender (our own content script, a tab, the top frame, the origin from
   the browser). New handlers in `localMode` blocks: the hangar view (E1's shared
   reader, its schema and never-sent checks, Firefox's data permission first), the
   scan status (from storage and a scan-running marker in session storage), and a
   scan request (opens or focuses the dashboard, which runs its own Scan; busy while
   a scan runs and for 60 seconds after a request).
4. `src/dashboard.js`: the scan-running marker (with a heartbeat and an expiry), the
   scan request it answers, and Firefox's consent card for the hangar page (its
   Continue only asks Firefox, never starts Connect).
5. `src/site-bridge.js`: only on its own copy of the page list, exact source and
   origin checks, the ask's shape (`id` up to 64 characters, a known type), answers
   to this origin only.
6. `scripts/pack.mjs`: the lists decided once and written into the manifest
   (externally_connectable on Chrome and Edge, the bridge's matches on Firefox), the
   built `site-pages.js` and the built bridge; staging hosts only in a developer's
   build pointed at another site; `localMode` needs `sync`.
   `scripts/check-store-build.mjs`: the manifest and the lists agree, exact
   `https://host/*` patterns, no `ids`, the hangar page only with `localMode` on, no
   staging host in a store or beta build. Passes with `localMode` on and off.
7. Tests with a fake chrome API: every message from every kind of page, wrong-page
   answers identical to unknown ones, malformed and oversized messages, the website's
   real v1 message shapes, the hangar view never carrying a forbidden key, the scan
   status and request, the bridge's checks, and real builds through the store check.
8. Technical docs: ARCHITECTURE.md, docs/FLAGS.md, docs/dev.

## Done Means

- `npm run format:check`, `npm test`, `npm run build` then
  `node scripts/check-store-build.mjs`, the beta build's check, `npm run lint:firefox`
  and `npm run test:ui` pass.
- The website's current pages (Add to RSI Cart, Connect) get the same answers as
  before, apart from the hello's new fields.
- No policy or store text changed; any wording they need is listed for the owner.
- New player-facing words are placeholders, listed for the copy pass.
