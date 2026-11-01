# Auto Scan Daily Returns

Goal: Auto Scan Daily comes back behind the developer-only `autoScanRun` build flag, on
the terms the owner said yes to (2026-11-01): opt-in, connected only, once a day at a
random time, a quick check first, a full scan only when something is new or a week has
passed, about a second between pages, no retries, and an account check first (by UEE
Citizen Record, else by handle). In a build with it, it replaces the Daily Scan
Reminder. It reads nothing and sends one notification when signed out, another account
is signed in, or scans are paused.

Steps:

1. The `autoScanRun` flag, developer builds only, needing `autoScan`.
2. The 0.4.0 run back (`ui/scan/auto.js`, `runner.autoScan()`), its keys renamed, with
   the new account check and no retries.
3. The worker's alarm at a random daily time, and the notification for a day skipped.
4. The popup's Auto Scan Daily switch in place of the reminder's, placeholder words.
5. Tests: the 0.4.0 tests back, plus the account check, no retries, the notification
   and the reminder replaced.

Not before the privacy policy, store listing and the popup's words are approved: this PR
stays a draft, and no store or beta build carries the flag.

Done: `npm run format:check`, `npm test`, `npm run build`, `npm run check:store` and
`npm run build:beta` pass.
