# feat/sync-schema

## Goal

One written-down format for what sync sends (#441), checked before anything leaves
the extension, and one shared function that builds the hangar in the "stored shape"
(what the website keeps for a synced hangar) so a later change can hand it to our own
hangar page without a second copy of the shaping code.

## Steps

1. `schema/sync-payload.schema.json`: a JSON Schema (2020-12 dialect, a small subset)
   for the sync payload: the backup file without the referral prospects list, history
   optional. Strict at the top level, `account`, `account.balances`, `sources`, the
   source entries and the referral block; pledge and buy-back rows typed where the
   values are known, extra keys allowed.
2. `src/schema-check.js`: a dependency-free validator for exactly the keywords the
   schema uses (an unknown keyword throws). Classic script for pages, the background
   worker, Firefox's event page and node. Returns `null` or `{ path, reason }` with a
   JSON Pointer path. `src/sync-schema.js` carries the schema for them, generated from
   the JSON file (`npm run schema`, and a test that fails when the two differ).
3. `test/fixtures/sync-schema/*.json`: invented conformance vectors
   (`{ name, valid, path?, payload }`), valid backups, a hangar view and each kind of
   failure.
4. `src/hangar-shape.js`: the pure shaping moved out of `src/lib.js` (account block,
   referral code removal, prospects removal, the lean archive, the export assembly,
   the stored DB check it reads through), plus the hangar view builder, its checks
   (schema and a forbidden-key walk) and a storage reader the background worker can
   call. `src/lib.js` keeps every public name and delegates.
5. Load the new scripts everywhere: `src/dashboard.html` before `lib.js`, the Chrome
   worker by `importScripts`, Firefox's `background.scripts` through
   `scripts/pack.mjs`. No new message handlers yet.
6. Sync checks its request body against the schema and refuses to send one that
   fails, through the existing sync error path, with reason `schema`.
7. Tests: the validator, the vectors, the schema copy, the hangar view (never the
   sync token, site address, settings, referral code or prospects), the storage
   reader, and backup files and sync bodies byte-for-byte the same as before for the
   same stored data. New test files go in package.json's test list.

## Done Means

- `npm run format:check`, `npm test`, `npm run build` then
  `node scripts/check-store-build.mjs`, and `npm run lint:firefox` all pass.
- A backup file and a sync body made from the same stored data are identical before
  and after the move.
- New player-facing words are placeholders, listed for the copy pass.
