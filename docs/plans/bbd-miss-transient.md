# bbd-miss-transient

## Goal

A buy-back's own page that fails with a 5xx or no network every time, while other pages
in the same batch read fine, gets the same day-then-doubling wait as a 404 (`bbdMisses`),
instead of being asked again on every scan. Behind the `bbdMissTransient` build flag, off
by default.

## Steps

1. Add `bbdMissTransient` to `src/flags.js` (default false), `docs/FLAGS.md` and
   `test/build-flags.test.js`.
2. In `OH.fetchBuybackDetails` (`src/lib.js`), with the flag on, note pages that failed
   for a passing reason as misses, but only when the batch read at least one page fine
   (so RSI being down for everyone never parks pages). Never on a slow-down stop.
3. Tests in `test/buyback-details.test.js`: flag off unchanged; flag on noted; flag on
   but nothing read, not noted; a slow-down stop, not noted.

## Done

`npm run format:check`, `npm run lint:firefox`, `npm test`, `npm run build`,
`npm run check:store` pass. No new words, permissions, data sources or requests.
