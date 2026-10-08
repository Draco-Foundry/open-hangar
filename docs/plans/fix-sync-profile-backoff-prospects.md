# fix/sync-profile-backoff-prospects

Goal: three sync fixes. A browser shared by two RSI accounts never sends the second
one's hangar to the first one's website login without asking; a connected extension
stops uploading its whole hangar after every scan just to hear "not open yet" or "too
soon"; and the sync body leaves out the referral prospects list (other players).

Steps:

1. `src/lib.js` `OH.siteSync`: the link remembers the RSI accounts synced through it
   (handle and Citizen Record) and the ones you said no to. A scan of an account the
   link hasn't seen asks first ("Sync <handle> to your openhangar.space account?"); the
   answer is kept per handle. The first account a fresh link syncs is the one that
   connected, so it isn't asked.
2. `src/lib.js`: after a `not-open` answer the sync after a scan waits 6 hours (Sync Now
   still tries). A 429 (`too-soon`) is a calm note, and its `Retry-After` is honoured by
   every sync, Sync Now included.
3. `src/lib.js`: the sync body drops `sources.referral.items.prospectsList`. The backup
   file keeps it.
4. `src/dashboard.js` and the scan report: the ask is a calm report with Sync It and
   Keep It Here; a skipped sync shows the website's note without sending anything.
5. Tests in `test/site-sync.test.js`; docs (ARCHITECTURE, FLAGS, CHANGELOG).

Done: `npm test`, `npm run format:check`, `npm run test:ui`, `npm run pack` and
`node scripts/check-store-build.mjs` pass.
