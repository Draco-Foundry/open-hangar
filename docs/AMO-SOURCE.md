# Source and Build Notes for Firefox Reviewers

From 0.2.12, Open Hangar's Home page is written in Svelte and compiled with Vite. This file
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

1. `vite build` compiles `ui/` (Svelte 5 components and CSS) into `src/ui/`
   (`home.js`, `home.css`, and the bundled font files in `src/ui/fonts/`). The output is
   **not minified**, so it can be read directly.
2. `node scripts/pack.mjs` copies the runtime files (`manifest.json`, `_locales/`,
   `icons/`, `src/`, `CHANGELOG.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`) into
   `dist/firefox/` and adds the Firefox manifest keys.

Everything else in `src/` (`dashboard.js`, `lib.js`, `background.js`, `scraper/`) is
hand-written and shipped as-is, not compiled.

## Linter Warning

`web-ext lint` reports one warning, `UNSAFE_VAR_ASSIGNMENT` (innerHTML) in
`src/ui/home.js`. It is inside the Svelte runtime, which creates its compile-time
templates by assigning fixed markup strings that are part of the compiled components.
No user, RSI or network data ever reaches that assignment; dynamic values are set
through text nodes and attributes.

## Remote Code

None. No remote scripts are loaded; fonts are bundled. Network requests are data only
(RSI pages for the signed-in user's own account, and public ship/game data from
star-citizen.wiki and starcitizen.tools), as described in `docs/PRIVACY.md`.
