# build-dev-profile

Goal: a developer's build never reads or overwrites the hangar of the Open Hangar
installed from a store.

Steps:

1. `scripts/pack.mjs --dev`: "Open Hangar (Dev)", purple icons with a DEV tag
   (`dev/icons/`), its own Firefox add-on id, into `dist/dev/` and `dist/dev-firefox/`.
2. `scripts/dev-run.mjs` and `npm run dev:chrome|dev:edge|dev:firefox`: web-ext run in
   a profile of its own (`.dev-profiles/`, gitignored), never the default profile.
3. `test/dev-build.test.js`.
4. README's development section and CLAUDE.md's commands.

Done: npm test, format:check, build + check:store, lint:firefox pass; the dev copy
launched in Chrome and Firefox in its own profile; CI green.
