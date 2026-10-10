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
