# A steady bell caught-up check (#791)

Goal: the smoke test's bell caught-up check passes or fails on the bell alone.

Steps:

1. Hold resize and scroll back from the menus while the check runs, counted.
2. Check every read is taken with the menu open.

Done: `npm run test:ui` passes.
