# Scan Bar On

Goal: the popup's scan bar ships in store and beta builds (owner, 2026-10-23).

- `scanBar` default on in `src/flags.js`; `docs/FLAGS.md` and the flag tests follow.
- The smoke test forces the flag off for the step-list part, on for the bar part.
- Changelog fragment waits on the line from Claude chat.

Done: tests, lint, build and `test:ui` pass (bell caught-up line aside).
