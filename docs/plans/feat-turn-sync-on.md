# feat/turn-sync-on

Goal: the public store build carries sync, the last 0.3.0 extension change. Sync stays
opt-in: nothing personal goes to openhangar.space until you Connect.

Steps:

1. `src/flags.js`: `sync` defaults to on. The beta keeps it on.
2. `scripts/pack.mjs`: a store build keeps the `@sync` blocks (the flag does that), is
   built in to production `app.openhangar.space`, and asks for `identity` in every build
   (Chrome, Edge, Firefox, beta). Staging stays out of anything a store gets; only a
   developer's `--site` build lets it in. Firefox keeps the site bridge for one-click
   Connect and declares sync's optional data collection.
3. `scripts/check-store-build.mjs`: the public check now wants the sync code, production
   built in, `identity`, Connect's way in for each browser and no staging. A build with
   sync off still gets the old checks.
4. `src/lib.js`: every sync request goes to `/api/v1/sync`.
5. Tests follow (build flags, beta build, sync, Firefox data, website bridge).
6. Docs: FLAGS.md, BETA.md, ARCHITECTURE.md, CONTRIBUTING.md, the decision records, and
   a changelog line. Store listing text is left alone (another PR).

Done: `npm run build`, `npm run pack`, `npm run build:beta` and `npm run build:staging`
build clean; `npm run check:store` passes on the store build and finds the sync code,
production and `identity`; the store build's code paths show nothing personal is sent
before Connect; `npm test`, `npm run test:ui`, `npm run format:check` and
`npm run lint:firefox` pass.
