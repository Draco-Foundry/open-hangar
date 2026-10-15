# Source and Build Notes for Firefox Reviewers

From 0.3.0, Open Hangar's pages (the toolbar popup, the basic page and, from 0.4.0, the
hidden scan page) are written in Svelte and compiled with Vite. This file
is what reviewers need to rebuild the exact package from the attached source. The source
is also public at https://github.com/Draco-Foundry/open-hangar (tag `v<version>`).

## Rebuild

Requirements: Node.js 22 (any 20.19+ works) and npm. Any OS.

```
npm ci
npm run build
```

The Firefox package is then in `dist/firefox/`. It should match the uploaded add-on file
for file, except for zip metadata.

What `npm run build` does:

1. `vite build` compiles `ui/` (Svelte 5 components and CSS) into `src/ui/`: one
   script per page (`popup.js`, `basic.js`, `scan.js`, and the developer dashboard's
   pages), `shared.js` for the code they share (including the Svelte runtime), their
   CSS, and the bundled font files in `src/ui/fonts/`. The output is **not minified**,
   so it can be read directly.
2. `node scripts/pack.mjs` copies the runtime files (`manifest.json`, `_locales/`,
   `icons/`, `src/`, `LICENSE`, `THIRD_PARTY_NOTICES.md`) into `dist/firefox/` and adds
   the Firefox manifest keys. The store build is the connector (docs/CONNECTOR.md), so it
   then leaves out the dashboard (`src/dashboard.*`, `src/quips.js`, `src/qr.js`,
   `src/assets/`, `CHANGELOG.md`) and every `src/ui/` file the popup, the basic page and
   the hidden scan page don't load.

**Open Hangar Beta** (the unlisted beta add-on, `open-hangar-beta@draco-foundry`) is
built from the same source with `npm run build:beta` instead; its Firefox package is
then in `dist/beta-firefox/` (docs/BETA.md lists how it differs).

Everything else in `src/` (`lib.js`, `background.js`, `scan-host.js`, `scraper/`, ...)
is hand-written and shipped as-is, not compiled.

## Linter Warnings

`web-ext lint` reports six warnings:

- Three `UNSAFE_VAR_ASSIGNMENT` (innerHTML) in `src/ui/shared.js`. They are inside the
  Svelte runtime, which creates its compile-time templates by assigning fixed markup
  strings that are part of the compiled components. No user, RSI or network data ever
  reaches those assignments; dynamic values are set through text nodes and attributes.
- Three `UNSUPPORTED_API` for `chrome.offscreen` in `src/scan-host.js`. That's the
  Chrome and Edge way to run a scan in a hidden page; the code checks for the API first,
  and on Firefox, which doesn't have it, the hidden scan page is a hidden frame instead.

The beta carries an `update_url` (it's self-distributed), so it's linted with
`web-ext lint --self-hosted`.

## Remote Code

None. No remote scripts are loaded; fonts are bundled. Network requests are data only,
to two places, as described in `docs/PRIVACY.md`:

- RSI pages for the signed-in user's own account.
- openhangar.space for public data (the status file, the ships feed with today's store
  prices, exchange rates and, with store alerts on, the sale feed) and, only if the user
  connects an account, sync and their Wishlist.

The ship list in `src/data/` is bundled in the package (built offline from the Star
Citizen Wiki's API; its notice is in `src/data/NOTICE.txt`), so it's never fetched.
