# RSI Account Logs in 0.5.8

Goal: RSI Account Logs (`accountLogs`) on in store and beta builds, with the approved policy.

Steps:

1. `accountLogs` on in `src/flags.js` (store and beta), the popup's off switch kept.
2. The approved policy change (Words privacy-ext.account-logs) in docs/PRIVACY.md,
   site/privacy.html and the generated store copies; Last updated 2026-11-01.
3. docs/STORE.md and docs/COMPLIANCE.md: the cookies and host justifications (4a, 4b).
4. A privacy test pairing the flag with its policy words.
5. No changelog fragment until Words changelog.0-5-8.account-logs is approved.

Done: format:check, test, build, build:beta, check:store, lint:firefox, test:ui pass.
