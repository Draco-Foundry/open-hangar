# Arrow Sweep (extension)

Goal: no arrow symbols in the extension's player text (owner rule, 2026-10-17).

Steps:
1. Drop the arrow where the plain words stay as they were (external-link marks, "Details →").
2. Update the guard strings in `scripts/screenshots/smoke.mjs`.
3. Leave the popup Settings tab (another session) and every case that needs new wording.

Done when: `npm run format:check` and `npm test` pass; the PR lists every changed line. Rides
the next release; no release here.
