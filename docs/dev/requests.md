# Requests

## Who the Extension Talks To

Only RSI and openhangar.space. Anything else it needs (game status, ships, catalog,
referral events, known issues) comes from openhangar.space's feeds. The extension never
loads remote code: what a build can do is fixed when it's built (build-time flags).

## Requests to RSI

- **The Scan stays fast:** list pages only. Anything needing one request per item
  (buy-back details and the like) is opt-in: a button, with progress, Stop, and a cache.
- **Be polite:** an honest User-Agent, one request at a time with pauses, no bursts,
  honor `Retry-After`, back off on 403/429/5xx and stop on a denial, cache where you can.

## Sync

What a sync sends is the backup format (`OH.exportDB`, `schemaVersion`), written down as
`schema/sync-payload.schema.json` (#441). The extension checks every sync against it before
sending, and the website checks the same format on its side with a pinned copy of the
schema and the vectors in `test/fixtures/sync-schema/`. A change to the format needs the
schema changed (then `npm run schema`), the vectors and sync tests updated here, the
privacy policy checked, and the website told before it ships.

## Our Pages Asking the Extension

Our own web pages reach the extension through bridge v2 (`src/site-pages.js`,
ARCHITECTURE.md "Messages From Our Pages"). A new request needs its capability and type
in `src/site-pages.js`, its exact keys there, its handler in `src/background.js` (behind
its flag's markers), the type in the Firefox bridge's list, tests in
`test/bridge-v2.test.js`, and the website told. A request from a page that may not ask
it answers `unknown request`, the same as one that doesn't exist. Anything handed to a
page is checked before it goes, and handing a page something new means checking the
privacy policy first.
