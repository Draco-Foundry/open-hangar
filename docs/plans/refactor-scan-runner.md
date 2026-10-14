# refactor-scan-runner (review fixes)

## Goal

The review's findings on the scan runner fixed on the same branch: the stored report
follows the shared contract, and the runner's marks, syncs and portrait copy behave.

## Steps

1. `scanReport.bad` stored as a boolean (held reports `false`); tests and the smoke
   check expect booleans.
2. A Sync Now pressed near a scan's end never stops the scan's own sync: `syncing` is
   set only when a sync is about to be sent.
3. `scanProgress` removed in a `finally` after the report, whatever throws after it.
4. `runner.marked()`: settles once the last scan has written its first mark, or won't
   run; `scanIfAsked` waits on it before taking the request.
5. The portrait: a failed copy isn't read again for the same address and account in
   this browser session; another account's copy goes when the signed-in one has none
   (and with its saved account, `OH.deleteProfile`).
6. `scanRequest` says who asked (`reason: 'popup' | 'site'`), so the report's reason
   is right.
7. `docs/CONNECTOR.md`'s outbound requests list the portrait read.

## Done

`npm run format:check`, `npm test`, `npm run test:ui`, `npm run build`,
`npm run check:store` and `npm run lint:firefox` pass; the plan file is gone.
