# refactor/opt-in-row

Goal: one switch row (ui/lib/OptInRow.svelte) draws every opt-in switch, so the
first-run setup can reuse it and a switch looks the same everywhere.

Steps:

1. OptInRow with the switch's look moved into it from popup.css.
2. Settings' five opt-in rows move onto it, no visible change.
3. A guard test fails on the settings switch drawn anywhere else.

Done: npm test, format:check, build:ui pass; test:ui passes with no visible change.
