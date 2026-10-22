# Page Change Warning

## Goal

Know that RSI changed the hangar or buy-back page before pilots report broken scans,
without sending anything new off a pilot's device.

## Steps

1. `OpenHangar.pageChanged(html, kind)`: a page with cards that has lost what the
   parser rules read from them (pledge id or name, any readable date, any items; a
   buy-back's name or any readable date) gives the reasons, else nothing.
2. Every scan runs it on every page it reads. A page that doesn't fit stops the scan:
   nothing of it is saved, the last scan stays, the flight log says why (on the
   device only). The old "markers but nothing read" stop counts as the same thing.
3. The scan report's row says so; the popup's scan bar shows the approved line
   instead of a trouble row.
4. Auto Scan Daily's record names the part whose page changed. A dev-only build flag
   turns that into a notification on the maintainer's own computer. No store build has
   it, so nothing changes for pilots' notifications.
5. Fixtures: two scrubbed pages changed the way RSI might change them trip the check;
   every saved page in the corpus doesn't.

## Done When

- `npm run format:check`, `npm test`, `npm run build`, `npm run check:store` and
  `npm run test:ui` pass; the dev flag's code is absent from store builds.
