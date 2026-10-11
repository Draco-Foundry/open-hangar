# Plan: ci/last-updated-badge

Goal: every README and the roadmap show when the project last changed, as a date and time in
UTC (Zulu), without anyone having to remember to update it.

Steps:

1. A workflow runs on each push to main and redesign/0.3-svelte (and by hand). It writes a
   small shields.io endpoint file, `last-updated.json`, to its own `badges` branch: one commit,
   replaced each time. Main stays untouched, so its rules and history don't change.
2. README.md and ROADMAP.md show a "Last Updated" badge that reads that file.

Done when: the workflow passes actionlint, it runs once after merge, and the badge shows the
time of the latest push in the form `2026-10-11 16:24Z`.
