# docs/auto-scan-daily-policy

## Goal

Auto Scan Daily's release, ready to land: the owner-approved privacy policy and
store-listing words for it (approved word for word 2026-11-01, with revised items 3 and
8), and `autoScanRun` on in store builds, with the guard tests that pair them. Draft until
the owner calls that release.

## Steps

1. docs/PRIVACY.md: items 1 to 8 (Short Version, What data is accessed, the Auto Scan
   Daily section, status file, Disconnecting, cookies, alarms, notifications). Item 9
   applies only with an Account History section.
2. site/privacy.html: the same words; regenerate privacy-plain.txt and privacy-amo.md with
   `npm run privacy:plain`.
3. docs/STORE.md: items 10 to 14.
4. docs/COMPLIANCE.md: alarms and notifications rows matched to items 10 and 11.
5. `autoScanRun` on in store builds; the policy's guard test checks Auto Scan Daily's
   section in place of the reminder's; reminder tests run a reminder-only build.
6. Left for the release: "Last updated", the changelog line, the README line.

## Done Criteria

- No "Daily Scan Reminder" left in the policy copies, STORE.md or COMPLIANCE.md's rows.
- `npm run format:check`, `npm test`, `npm run build` and `npm run check:store` pass.
