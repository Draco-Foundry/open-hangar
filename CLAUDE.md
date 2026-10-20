# Working on Open Hangar

Rules for anyone (people or AI sessions) changing this public repo. They come from the
owner's decisions and aren't visible in the code. Big picture: [ARCHITECTURE.md](ARCHITECTURE.md).
Detail lives in the topic files linked below; each rule is written in one place only.

## Overview

The Open Hangar browser extension (Manifest V3; Chrome, Edge, Firefox 140+) that reads the
player's own RSI account, plus openhangar.space's static files and front Worker. Since 0.3.0
the extension is the connector for openhangar.space ([docs/CONNECTOR.md](docs/CONNECTOR.md)).

## Stack

Plain JavaScript (no TypeScript) and Svelte 5, built with Vite 8 (unminified on purpose:
store reviewers read it), then `scripts/pack.mjs` writes `dist/<browser>/`. Dev dependencies
only: Prettier, web-ext, jsdom and jsqr (tests), puppeteer-core (drives the installed Chrome).

## Layout

- `src/`: what ships. `background.js` (service worker; Firefox event page), `lib.js`
  (`window.OH`: scan, storage, export, feeds, sync), `scraper/parser.js`, `flags.js`,
  `popup.html` and `basic.html` (the connector pages), `scan.html` and `scan-host.js` (the
  hidden scan page). `src/ui/` is Vite output (gitignored).
- `ui/`: Svelte sources, one folder per page with a `main.js` entry (vite.config.mjs);
  shared code in `ui/lib/`. Only `ui/popup/`, `ui/basic/` and `ui/scan/` (the scan
  runner the hidden scan page runs, or the basic page when it can't) reach store builds.
- `site/`: openhangar.space static files (`status.json` is the live kill switch);
  `site-worker/`: its front Worker.
- `schema/`: the sync payload's JSON Schema. `test/`: `*.test.js` and `fixtures/`.
- `scripts/`: build, checks, generators, publishing. `docs/`: topic files, `decisions/`,
  `plans/` (branch plans only). `beta/`, `_locales/` (the manifest's name and
  summary, English only since #685), `icons/`.
- `_dump/`: local scratch, gitignored. Never commit it.

## Commands

Same on Windows and Mac unless noted.

- Install: `npm ci` (its `prepare` sets git's hooks path to `scripts/hooks/`)
- Test: `npm test` (an explicit list of files: add a new test file to it)
- Format: `npm run format:check` / `npm run format`
- UI: `npm run build:ui`; watch `npm run dev:ui`; demo at localhost:8323 `npm run demo`
- Smoke test: `npm run test:ui` (needs Chrome; set `CHROME_PATH` if it's elsewhere)
- Build: `npm run build`, then `npm run check:store`; Firefox lint: `npm run lint:firefox`
- Store zips: `npm run pack`; beta: `npm run build:beta`; privacy check after pack:
  `npm run test:privacy`. Dev flags: `npm run build -- --flag name=on --site=<url>`
- Generators: `npm run schema`, `npm run rules`, `npm run privacy:plain`
- Parser report over saved pages: `npm run report:parser`; scrub a saved page: `npm run scrub`
- Env vars in docs are POSIX (`OH_SITE=… npm …`). PowerShell: `$env:OH_SITE='…'; npm …`

## Conventions

- `src/*.js` are classic scripts hanging objects on `window.OH`/`self.OH*` (no imports);
  `ui/` is ES modules; `scripts/*.mjs` ESM; tests CommonJS (`node:test`, `node:assert/strict`).
- Svelte: PascalCase components, state in `*.svelte.js`. A page's words live in one module
  (`ui/basic/copy.js`, `ui/popup/copy.js`): the owner's approved words, word for word.
- Prettier: single quotes, 100 columns; it only checks `js, html, json, md` (not `.mjs`,
  `.svelte`, `.css`). No ESLint or type check: web-ext lint is the only linter.
- Guard tests block a change until its pair is updated (permissions, storage budget,
  privacy policy, export bytes, sync schema, build flags). Update both, never the test alone.
- PR titles are Conventional Commits with a lowercase scope; squash-merge. Player-facing
  changes get a CHANGELOG bullet under `## Unreleased` ([docs/dev/git.md](docs/dev/git.md)).
- Words, look and what not to build: [docs/dev/copy-and-style.md](docs/dev/copy-and-style.md),
  [docs/VOICE.md](docs/VOICE.md). Requests: [docs/dev/requests.md](docs/dev/requests.md).
  Tests and builds: [docs/dev/testing.md](docs/dev/testing.md). Flags: [docs/FLAGS.md](docs/FLAGS.md).

## Related Repos

- **Draco-Foundry/open-hangar-server** (private): app.openhangar.space. The extension calls
  its `/api/link/*`, `/api/v1/sync`, `/api/v1/wishlist*` and the openhangar.space feeds
  (`api/ships`, `api/catalog`, `api/store/on-sale`, `status.json`, …; `OH.SITE_FEEDS` in `src/lib.js`).
- Coordinate with it: `schema/sync-payload.schema.json` and `test/fixtures/sync-schema/`
  (it pins a copy), bridge v2 message types (`src/site-pages.js`), alert `nameKey`s,
  `site-worker/`'s forwarded paths, and `src/quips.js`. How: docs/dev/requests.md.

## Rules

- **Never release.** No version bumps, `npm run release`, the publish workflow or store
  uploads. Releases are the maintainer's.
- **Never push to `main` directly.** Open a PR.
- **Never put private data in issues, PRs or commits** (the repo is public): no emails,
  addresses, hangar contents or tokens. Nothing from the private server repo comes here.
  Never commit secrets or `.env` files.
  The one exception is saved RSI pages scrubbed by `npm run scrub` into
  `test/fixtures/corpus/` (README there). Why (2026-10-18): the parser needed real pages
  to test against; the maintainer chose to scrub ids, prices, dates and account details.
- **Private notes stay local.** A maintainer may keep a gitignored `CLAUDE.local.md` with
  their own rules. Never commit it or anything it points to (CI and the pre-commit hook
  check).
- **Never load remote code.** Feature flags are build-time only (store policy).
- **All HTML insertion goes through `setHTML` (`src/safe-html.js`; `use:safeHTML` in Svelte).**
  Text from RSI goes in as text (`textContent`, `{value}`); `test/html-insertion.test.js` checks.
- **npm only**, one lockfile (`package-lock.json`). Ask before adding a dependency.
- **Read first, keep changes small:** one concern per PR, no refactoring of unrelated code.
  Debug by theory, steps with an expected result each, one at a time; file the rest.
- **Plan file:** a branch starts with `docs/plans/<branch>.md` (goal, steps, done
  criteria), deleted before merge (CI fails a PR that still has one). Anything left
  undone becomes a GitHub issue. Code and comments never mention plan files.
- **Flag any change that needs the website** (the list above) in the PR.
- **Done means:** `npm run format:check`; `npm test` all pass; `npm run test:ui` for any
  screen change (needs Chrome; say so in the PR if it couldn't run) with that page's smoke
  test updated; build changes: `npm run build` then `npm run check:store`; anything touching
  the background worker, fetching or CSP: checked in Chrome, Edge and Firefox
  (`npm run lint:firefox` too) and a narrow window.

## Gotchas

- Merging to `main` deploys openhangar.space straight away when `site/` or `site-worker/`
  changes (pages.yml). `site/status.json` reaches every installed extension.
- Store builds ship only the connector: dashboard pages in `ui/` don't reach players.
- Generated, don't edit: `src/ui/`, `src/sync-schema.js`, `src/parser-rules-data.js`,
  `docs/store-assets/privacy-plain.txt`, `site/stars.css`, `src/data/ship-catalog.json` (bot).
- `pack.mjs` rewrites exact placeholders (`const SITE_BUILT_IN = '';`, `BUILD_VALUES`,
  `BUILD_PAGES`, `PAGES`) and cuts `@flag-start/@flag-end` markers. Markers don't survive
  Vite: in `ui/` use `flag()`. A new `importScripts` needs `WORKER_SCRIPTS` in pack.mjs too.
- A stale `src/ui/` (an old `build:ui`) fails the permission-pin tests: run `npm run build:ui`.
- Windows: `check:store` on zips shells out to `unzip` (Git's `usr\bin` must be on PATH).
  `.gitattributes` forces LF; a CRLF save fails `format:check`.
- `npm run release` pushes `main` and a tag itself, which starts publishing. Maintainer only.
- The privacy policy lives in three places (docs/PRIVACY.md, site/privacy.html, the plain
  txt), tests keep them equal, and its words are the owner's.
