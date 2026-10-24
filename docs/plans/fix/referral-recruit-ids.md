# fix/referral-recruit-ids

Goal: recruits and prospects keep only their dates (enlisted, converted) and the
recruit's campaign. No RSI id, handle, moniker or avatar is stored, exported or synced.
Counts stay.

Steps:

1. A scan keeps ids in memory only (to tell current recruits from legacy), then saves
   date-only rows.
2. Storage v3 to v4: the stored referral rows lose those keys (live DB, parked
   accounts, the recovery copy). Test a migrated case and an unchanged case.
3. Import and the dashboards read date-only rows.
4. The sync schema and its vectors: the recruit row types only the dates and campaign.
5. Website: re-pin the schema and strip the keys there (separate PR).

Done: format check, npm test, build and check:store pass; the website PR is named.
