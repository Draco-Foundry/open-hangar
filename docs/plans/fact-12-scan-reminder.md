# Daily Scan Reminder

Goal: Auto Scan Daily becomes a reminder. The extension never reads RSI on its own; a
notification once a day at most asks the pilot to scan, and their click starts Scan.

Steps:

1. The worker's alarm shows a notification instead of asking the hidden page to scan.
2. The popup's switch becomes the Daily Scan Reminder (asks for notifications).
3. Pilots who had Auto Scan Daily on keep the reminder on when notifications are allowed.
4. Auto Scan Daily's run goes from the hidden page; the status file still pauses it.
5. Tests, smoke test, dev docs, README and the changelog line.

Done: `npm test`, `npm run test:ui`, `npm run build` and `npm run check:store` pass.
