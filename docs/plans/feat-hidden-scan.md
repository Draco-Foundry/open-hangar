# feat-hidden-scan

## Goal

Pressing Scan in the popup runs the scan with no visible tab: Chrome and Edge in an
offscreen document, Firefox in a hidden frame of the event page, the old tab only as the
fallback.

## Steps

1. The hidden page: `src/scan.html` and `ui/scan/main.js` (Vite entry), the scan
   runner with `by: 'offscreen' | 'frame'` and its run from the address.
2. Chrome and Edge: `src/scan-shim.js` gives the offscreen page `chrome.storage`,
   `chrome.permissions.contains` and `getManifest` over one message type, answered by
   the worker only for that page.
3. Firefox: the event page holds the page in a hidden frame, which pings it after every
   page and every 10 seconds; the Firefox CSP gets `frame-src 'self'`.
4. `src/scan-host.js`: the host chooser (offscreen, frame, tab), the kill switch
   (`sources.scanHidden`), requestScan's host, busy checks, the update wait, done.
5. `offscreen` permission on Chrome, Edge and the Chromium beta only, its pins and
   policy check, docs/STORE.md.
6. The approved 0.4.0 privacy policy words, both copies, then `npm run privacy:plain`.
7. The slim Open Hangar page: no lists, search, totals or CSV.
8. Tests: host chooser, sender check, fallback, update wait, harness, smoke, privacy
   check.

## Done

`npm run format:check`, `npm test`, `npm run test:ui`, `npm run build` +
`npm run check:store`, `npm run lint:firefox` all pass; the PR lists the owner's checks
by hand in Chrome, Edge, Firefox and a narrow window.
