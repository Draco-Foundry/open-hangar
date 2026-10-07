# Build Flags

Some features ship in some builds and not others: Org Fleet sharing only in a
developer's own build, for one. Build flags say which, in one place.

## Build-Time Only

A flag is decided when the extension is built, and nothing changes it after that.
**The extension never fetches a flag, a config or code to turn a feature on.** The
stores don't allow remote code or remote feature switches, so there is no remote config
here, ever. To change a flag for users, ship a new build.

Features on the website (openhangar.space) are switched on the website's side, by its
own flags. When the extension asks the website something, the answer is data (a list,
a status, "not available"), never code.

## The Registry

[`src/flags.js`](../src/flags.js) lists every flag:

```js
orgFleet: {
  about: 'Org Fleet sharing with your org on the website. Nothing behind it yet.',
  default: false,
  devOnly: true,
},
```

- `about`: one line on what the flag turns on.
- `default`: its value in the public store build. Off unless there's a reason.
- `beta` (optional): its value in Open Hangar Beta ([BETA.md](BETA.md)). Left out, the
  beta gets `default`.
- `devOnly` (optional): `true` keeps it out of every store build, the beta included.

Today's flags:

| Flag       | What it turns on                                   | Store | Beta | Dev-only |
| ---------- | -------------------------------------------------- | ----- | ---- | -------- |
| `sync`     | Website sync (Connect This Browser, Sync Now, ...) | on    | on   | no       |
| `orgFleet` | Org Fleet sharing (nothing behind it yet)          | off   | off  | yes      |

## Adding or Retiring a Flag

1. Add an entry to `REGISTRY` in `src/flags.js`: a camelCase name, `about` and
   `default` (plus `beta` or `devOnly` if needed).
2. Read it in code (below), and wrap code that must not ship while it's off in markers.
3. Run `npm test`: `test/build-flags.test.js` checks the registry, every marker and
   every flag the code reads.

To retire a flag, remove its entry. The build then fails on any marker still naming
it, so the code it guarded has to be kept (markers removed) or deleted on purpose.

## Sync in the Store Build

`sync` is on in every store build from 0.3.0: its code stays (the `@sync` blocks), it's
built in to production (`app.openhangar.space`), and every build asks for `identity`
(Connect's sign-in window; it's in `manifest.json`). On Firefox the site bridge
(`src/site-bridge.js`) lets the website's Connect This Browser in, and the manifest lists
what sync sends as optional data collection, asked on the first Connect.

It stays opt-in: nothing personal goes to openhangar.space until you Connect. Before
that, the extension only reads the public feeds (game status, ships, catalog, rates and
the like), which carry nothing about you. Until launch day the website answers a sync
from an account without beta access with "Sync opens November 10" (reason `not-open`,
a switch on the website's side): the extension shows that as a calm note in the scan
report ("Not Synced Yet"), not a problem, and stays connected.

`--flag sync=off` still builds a copy without it, for a developer; the store check
refuses that build.

## How Builds Set Them

`scripts/pack.mjs` picks each build's values and writes them into that build's copy,
`dist/<target>/src/flags.js` (`BUILD_VALUES`). The file in the repo always holds the
defaults.

| Build                                                        | Flags                                       |
| ------------------------------------------------------------ | ------------------------------------------- |
| `npm run build`, `npm run pack` (public store)               | every flag at its `default`                 |
| `npm run build:beta`                                         | the beta set, exactly (no `--flag`)         |
| `npm run build:staging` (or `--site=<url>`, `OH_SITE=<url>`) | the defaults, built in to that site instead |
| `--flag name=on` / `--flag name=off`, repeatable             | a developer's own build, on top of any      |

For example `npm run build -- --flag orgFleet=on`. `OH_SYNC=1` and `--sync` are the
older spelling of `--flag sync=on`, which is the store build now. A build with a site of
its own lets the staging site talk to it too. The build log lists the flags that are on,
and calls the build "dev build, never for a store" when a dev-only flag is on, a flag is
off its default, or the built-in site isn't production.

`scripts/check-store-build.mjs` (`npm run check:store`, and `--beta` for the beta)
fails unless every build in `dist/` carries `src/flags.js` with exactly its set: the
defaults for the public build, the beta set for the beta, and no dev-only flag on. With
`sync` on, each build (every folder and every zip) also needs the sync code, built in to
production only, the `identity` permission and the website's way in (Chrome and Edge:
`externally_connectable`; Firefox: the site bridge and sync's optional data collection),
and no staging site anywhere.

## Reading a Flag

`OH.flags.<name>` is `true` or `false`:

- **Dashboard:** `src/dashboard.html` loads `flags.js` before `lib.js`, so
  `window.OH.flags` is there for `lib.js`, `dashboard.js` and the rest.
- **Background worker:** `src/background.js` imports it (`self.OH.flags`). Firefox's
  event page has no `importScripts`, so its manifest lists `src/flags.js` first.
- **Svelte pages:** `flag('orgFleet')` from `ui/lib/flags.js`. A retired or unknown
  flag reads `false`.

## Markers

Code that must not ship in builds where a flag is off goes between markers. Each
marker sits on a line of its own, in a comment:

```js
// @flag-start orgFleet: Org Fleet sharing
shareFleet();
// @flag-end orgFleet
```

```html
<!-- @flag-start orgFleet -->
<script type="module" src="ui/org-fleet.js"></script>
<!-- @flag-end orgFleet -->
```

- With the flag off, `scripts/pack.mjs` cuts both marker lines and everything between
  them from every `.js`, `.html` and `.css` file under `dist/<target>/src`. With it
  on, the block stays as written.
- Blocks never nest. A block left open, an end that doesn't match its start, a marker
  without a name or one naming a flag the registry doesn't have all fail the build.
- `@sync-start` and `@sync-end` are the `sync` flag's markers under their older name.
- The Svelte build (`npm run build:ui`) drops comments, so markers inside `ui/`
  sources don't survive into `src/ui/`. For a whole Svelte page, put its `<script>` tag in
  `src/dashboard.html` inside a block (the way `ui/site.js` sits in a sync block);
  inside a page, use `flag()`.
