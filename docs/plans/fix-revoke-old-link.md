# fix-revoke-old-link (#741)

Goal: connecting again while already connected revokes the old link on the website, so
the account's Connected Extensions list doesn't keep a row that never syncs again.

Steps:

1. `src/background.js` `oh-connect-finish`: after saving the new `siteLink`, if the one
   it replaced had a different token, `DELETE /api/v1/sync` with the old token, at the
   site that link was made on. Best effort.
2. `src/lib.js` `OH.siteLinkWait` (code flow): the same.
3. Tests in `test/site-connect.test.js` and `test/site-sync.test.js`: old token revoked,
   same token not revoked, a failed revoke still saves the new link.

Done: `npm run format:check`, `npm test`, `npm run test:ui` pass. No sync-format, schema
or allowed-host change.
