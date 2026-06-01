# Contributing

The most valuable thing you can contribute is keeping `src/scraper/parser.js`
working, because RSI changes their site and the rest of the extension depends on
this layer staying honest.

## How auth works

The scan runs in the extension's own dashboard page, not in a content
script. The extension's `host_permissions` for `robertsspaceindustries.com` let
`fetch(..., { credentials: 'include' })` carry the browser's existing RSI session
cookie, so no RSI tab needs to be open — only an active RSI login in the profile.
(The scan can't run in `background.js`: MV3 service workers have no `DOMParser`,
which `parser.js` needs.) The one fragility: if RSI ever marks its session cookie
`SameSite=Strict` *and* Chrome withholds it from extension requests, the fetch
comes back logged-out. The fallback would be to scan via a hidden RSI tab
(`chrome.tabs.create` → content script) — not implemented while the direct fetch
works.

## Rediscovering the data source

When a scan returns nothing (or garbage), RSI probably changed something.
Here's how to find the new shape:

1. Log in at `https://robertsspaceindustries.com/account/pledges`.
2. Open **DevTools → Network** tab. Tick **Preserve log**. Filter to **Doc/Fetch**.
3. Scroll/paginate through your hangar and watch what requests fire.
4. For the request that returns your pledges, note:
   - **URL** and **method** — today it's a `GET` to
     `https://robertsspaceindustries.com/account/pledges?page=N&pagesize=10`,
     returning server-rendered HTML. `OH.scanHangar()` in `lib.js` builds this
     (the `PLEDGES_URL` / `PAGE_SIZE` constants); update it if the URL shape or
     method changes (e.g. if RSI moves to a JSON/POST endpoint).
   - **Response** — currently an HTML page. Each pledge is a `.row` card holding
     hidden inputs (`.js-pledge-id`, `.js-pledge-name`, `.js-pledge-value`,
     `.js-pledge-currency`) plus zero or more `.kind` tiles describing contained
     items. If the selectors or card container change, fix `resolveCard()` and
     `readContents()` in `src/scraper/parser.js`.
   - **Classification** — `normalizePledge()` derives `isCCU` / `isAddOn` /
     `containsShip` from the name and `.kind` set. If RSI changes naming
     conventions, update the `CCU_RE` / `ADDON_NAME_RE` patterns there.
   - **Token (only if you add write actions)** — `getCsrfToken()` in `parser.js`
     looks for an anti-forgery token in a `<meta>` tag, cookie, or JS global. The
     read-only scan doesn't need it, but a future melt/buyback action would.
5. Confirm how "no more pages" is signaled. RSI clamps an out-of-range `?page=`
   to the last page rather than returning empty, so `OH.scanHangar()` terminates
   when a page yields **no new pledge IDs** (dedup-based), not on an empty
   response. Preserve that behavior if you change the loop.

Tip: right-click the request → **Copy → Copy as fetch** to get a working
template you can paste into the console and tweak. The verification snippets in
the PR/commit history are a fast way to confirm selectors against a live hangar
before committing parser changes.

## Adding a data source

Sources are declared in `OH.SOURCES` (`src/lib.js`). To add one:

1. Add an entry: `{ id, label, type, … , parse }`.
2. Provide a `parse()` that turns the raw payload into an array of normalized
   items (reuse / extend `src/scraper/parser.js`).
3. If it's a new transport (e.g. `graphql`), add a `scan<Type>Source()` pipeline
   in `lib.js` alongside `scanHtmlSource()` and branch on `src.type` in
   `OH.scanSource()`.

The scan is persisted automatically under `storage.db.sources[id]`, and
`OH.loadSource(id)` reads it back. Today only `html` is implemented; buy-backs
(GraphQL) and store data (API) are the next pipelines — see ROADMAP.md / TODO.md.

## Versioning

[SemVer](https://semver.org), with one project rule: we stay in `0.0.x` during
pre-release development. **`0.1.0` is reserved for the first public GitHub
release.** After that, bump **minor** (`0.2.0`…) for features and **patch**
(`0.1.1`…) for fixes; `1.0.0` is the first "official/stable" release. The version
lives only in `manifest.json` (the Home page badge reads it from there).

## Principles

- **Keep `parser.js` the only place that knows RSI's field names / selectors.**
  Everything downstream should depend on the normalized model, not raw RSI data.
- **Be a good citizen.** Keep the throttle (`DELAY_MS`) in `lib.js`. Don't add
  parallel page fetching. This is for personal use, not bulk scraping.
- **No silent data exfiltration, ever.** Any sync feature must be opt-in,
  documented, and ideally self-hostable. Keep it out of the core scraper.
- **No credential handling.** We rely on the existing session cookie only.

## Local testing without RSI

You can unit-test `parser.js` in isolation by feeding it saved sample payloads
(scrub anything personal first). Capturing a real response from DevTools and
saving it as a fixture is the fastest feedback loop.

## Firefox notes

Firefox MV3 uses an event page rather than a true service worker and has some
differences in `chrome.*` vs `browser.*` namespaces. The `chrome.*` calls here
work via Firefox's compatibility shim, but if you hit issues, that's the first
place to look.

## PRs

Small, focused PRs are easier to review. If you're fixing the parser after an
RSI change, mention the date and what changed — it helps the next person.
