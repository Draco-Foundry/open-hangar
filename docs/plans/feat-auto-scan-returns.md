# Auto Scan Returns

Goal: the Daily Scan Reminder can scan by itself (Auto Scan), behind the `autoScanRun`
build flag: off in store builds, on in the beta. It reads RSI only when the account
signed in is the one this browser last scanned (and one the link synced); otherwise it
reads nothing and shows the reminder's notification.

Steps:

1. The `autoScanRun` flag (store off, beta on), needing `autoScan`.
2. The worker: when a reminder is due and Auto Scan is on, ask the hidden scan page for a
   scan (`requestScan('auto')`, never a tab); its report decides whether the
   notification shows after all.
3. The runner: the account check before any read (no owner, not connected, an owner the
   link doesn't know, signed out, another account, RSI not answering: held).
4. The popup: Auto Scan's switch under the reminder's, with placeholder words.
5. Tests for each account case, the worker's fallbacks and the flag's builds.

Not before the privacy policy, store listing and the switch's words are approved: this
PR stays a draft, and the flag stays off in store builds.

Done: `npm run format:check`, `npm test`, `npm run build`, `npm run check:store` and
`npm run build:beta` pass.
