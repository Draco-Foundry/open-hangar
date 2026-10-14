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

## Extension Alerts

The `alerts` flag's checks (src/alerts.js) ask openhangar.space for two things, no more
than once every 30 minutes (an alarm, 30 to 35 minutes apart): the public sale feed
(`/api/store/on-sale`, with its ETag, nothing about the pilot in the request) and, only
while connected, the account's Wishlist keys (`/api/v1/wishlist`, the sync token, read
only). Retry-After is honored, a failure doubles the wait up to 6 hours, a copy younger
than 10 minutes is used as it is, and nothing is asked before the pilot turns alerts on.
Everything is matched on the device; nothing goes back. A change to either feed's shape
is a new `v` on the website, and the name fold (`nameKey`) must stay the website's
`saleKey`: both repos test the same strings.

## Auto Scan Daily

The `autoScan` flag's daily run (#666, ui/scan/runner.js `autoScan`, src/background.js)
reads the pilot's own RSI account in the hidden scan page, the same pages Scan reads and
never more: no buy-back packs. Its budget, per pilot with it switched on:

- **At most one run a day**, at the pilot's own random time (20 to 28 hours after the
  last), so 5,000 pilots spread over the whole day. A day missed while the browser was
  closed runs once, 10 to 30 minutes after it's back, never one per day missed.
- **0 requests** when it's off, not connected, paused (below), a scan began or its own
  last run ended in the last 20 hours, RSI asked it to back off, the browser is offline, a
  scan is running, there's no hidden page, the live hangar is another account's, or
  RSI's sign-in cookie isn't in the browser (signed out: the cookie's presence only,
  nothing sent).
- **1 request** (the dashboard) when RSI says signed out or another account is signed in.
- **3 requests** for the quick check that finds nothing new: the dashboard, the newest
  page of the hangar, the newest page of buy-backs. It saves and sends nothing.
- **A full read** only when something on those pages is new, a part didn't finish or
  wasn't kept last time, the last complete read is 7 days old, or a saved scan's sync
  never went out: Scan's requests (the account and its dossier, every hangar and
  buy-back page, the referral lists) plus the quick check's and one dashboard read after
  each part (the account check), about Scan's count plus 6. For 150 pledges that's
  about 27 to 29 requests, against Scan's 23 and up to 30 pack reads.

At 5,000 pilots with about one day in five a full read: about 4,000 × 3 + 1,000 × 29, or
41,000 requests a day, about 0.5 a second spread over the day.

How it asks:

- **Paced:** 500 to 1000 ms, jittered (`OH.autoPause`), before every request but the
  run's first, one at a time.
- **Retry-After and backoff:** a 429 comes straight back (never retried), as does a 5xx
  that carries Retry-After; other 5xx and network errors keep Scan's three retries. A run
  that RSI didn't answer, or that stopped partway for any reason (a 4xx, a page it can't
  read), stops there, saves nothing more, and the next one waits a day, doubling each run
  in a row up to 4 days, and never before Retry-After (seconds or an HTTP date, also up
  to 4 days). It's kept in its record (`autoScan.retryAt`), and the worker moves the
  alarm after it.
- **The 20-hour rule:** no run within 20 hours of any scan's start or of its own last
  run's end (a quick check too, so switching it off and on doesn't run it again).
- **Pauses** (`site/status.json`, docs/RSI-CHANGES.md): `sources.autoScan` pauses it
  alone, `hangar` pauses it too, `buybacks` or `referrals` skip that part, and
  `scanHidden` off skips the day (it never runs in a tab).
- **Identify:** its requests go with the browser's own User-Agent. An extension can't
  set it (`fetch` forbids the header), so the polite rule's honest User-Agent is the
  browser's.

To openhangar.space it sends only the sync of what it saved (or of a saved scan whose
sync never went out), as any scan does, and reads the cached `status.json`.

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
privacy policy first. A new page needs the policy to name it before a store or beta
build may let it in (`test/privacy-permissions.test.js` fails until it does), and the
policy's words are the owner's to approve.
