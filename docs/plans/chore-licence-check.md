# chore-licence-check

Goal: CI fails on a GPL, LGPL or AGPL package in the lockfile.

Steps:

1. `scripts/check-licences.mjs` reads `package-lock.json`; permissive OR choices pass; an allow
   list by name with reason and review date (empty today).
2. `test/check-licences.test.js`, added to `npm test`.
3. One step in the existing `test` job, no new workflow.

Done: the check passes on today's lockfile, tests and format pass, this file deleted before
merge.
