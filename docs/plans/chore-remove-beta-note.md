# Remove the Open Beta "Still Spooling Up" notice

Goal: delete the open-beta notice whose own comments say to remove it after the
November 10, 2026 release. It already hides itself after 2026-11-11, so nobody sees a change.

Steps:

1. openhangar.space: the `#beta-note` aside (`site/index.html`), its block in `site/main.js`, its CSS in `site/style.css`.
2. Dashboard: the card and CSS in `src/dashboard.html`, its block in `src/dashboard.js`.
3. Demo smoke test (`scripts/screenshots/smoke.mjs`): drop the card check (demo clock is 2026-10-01, so it showed there).

Done: no `beta-note` / `ohBetaNoteClosed` left; format:check, npm test, build, check:store pass.
