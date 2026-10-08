# Working on Open Hangar

Rules for anyone (people or AI sessions) changing this public repo: the browser
extension (the scraper that reads the player's RSI account) and the static files and
front Worker behind openhangar.space (`site/`, `site-worker/`: help, privacy,
status.json and the fallback home page). They come from the owner's decisions
and aren't visible in the code. Big picture: [ARCHITECTURE.md](ARCHITECTURE.md), the
0.3.0 plan [docs/REDESIGN-0.3.md](docs/REDESIGN-0.3.md). Detail lives in the topic files
below; each rule is written in one place only.

## Never

- **Never release.** No version bumps, `npm run release`, the publish workflow or store
  uploads. The owner releases, one store update a day at most.
- **Never push to `main` directly.** Open a PR.
- **Never put private data in issues, PRs or commits** (the repo is public): no emails,
  addresses, hangar contents or tokens. Nothing from the private server repo comes here.
- **Never load remote code.** Feature flags are build-time only (store policy).

## How to Work

- **npm only**, one lockfile (`package-lock.json`). Never add another.
- **Read first.** Read the code around a change and follow its patterns.
- **Keep changes small.** One concern per PR. No refactoring of unrelated code.
- **Debugging:** understand the problem, state a theory, plan steps with the result you
  expect from each, test them one at a time. Fix what you came to fix; file the rest.
- **Plan file:** a branch starts with `docs/plans/<branch>.md` (goal, steps, done
  criteria). Delete it before merge (CI fails a PR that still has one). Anything left
  undone becomes a GitHub issue. Code and comments never mention plan files.
- **0.3.0 rebuild:** PRs go into `redesign/0.3-svelte`, one page per PR, `src/lib.js`
  stays as it is (docs/dev/git.md).

## Done Means

1. `npm run format:check`
2. `npm test`: all pass (the sync format tests included)
3. `npm run test:ui` for any screen change (needs Chrome; say so in the PR if it
   couldn't run), with the page's smoke test updated alongside it
4. Build changes: `npm run build`, then `node scripts/check-store-build.mjs`
5. Anything touching the background worker, fetching or CSP: checked in Chrome, Edge
   and Firefox (`npm run lint:firefox` too), and in a narrow window

## Topic Files

- [docs/dev/copy-and-style.md](docs/dev/copy-and-style.md): words, look, what not to build
- [docs/dev/requests.md](docs/dev/requests.md): requests to RSI and openhangar.space
- [docs/dev/testing.md](docs/dev/testing.md): the test suites and builds
- [docs/dev/git.md](docs/dev/git.md): branches, PR titles, the changelog, releases
- [docs/VOICE.md](docs/VOICE.md): the voice and joke pools
