# Scan Recovery

## Goal

A scan that stops partway (tab or browser closed, signed out of RSI, network gone, the
worker restarted) never leaves the popup showing Scanning, never saves a partial read over
the last full hangar, and says what happened in one line with Scan Again.

## Steps

1. Heartbeat: the scan mark is renewed every 30 seconds while a scan reads; a mark quiet
   for 2 minutes is a scan that stopped (popup, worker, hidden page host, other pages).
   The worker clears a quiet mark when it starts.
2. A partial read (RSI stopped answering, signed out partway) is never saved over a saved
   part. A pressed Scan now notices a signed-out page after page 1 too.
3. The popup's line at the top: signed out, or stopped, with Scan Again.
4. Auto Scan Daily: a run that stopped doesn't count as the day's scan, and it is tried
   once more on the next popup open or browser start (at most once in 20 hours).
5. Tests and a CHANGELOG bullet.

## Done Criteria

`npm run format:check`, `npm test` and `npm run test:ui` pass; CI green; draft PR ready.
