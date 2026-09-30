# app.openhangar.space: plan

Decided 2026-09-28. The extension stays the scraper and keeps working fully offline;
**syncing to the website is opt-in**. The website adds accounts, your hangar on any
device, orgs with live combined fleets, and (later) Star Citizen reference data.

## Extension or Website: Where Each Feature Goes

Decided 2026-09-30. Both are needed, and the line between them is fixed:

- **The extension can't do it all:** two people's extensions can't find each other,
  so linking org members, enforcing consent and comparing fleets need one shared server.
- **The website can't do it all:** RSI has no API, so a hangar can only be read from
  the player's own signed-in browser. A site would need their RSI password, which we
  never ask for.

| Extension                                                | Website (behind a login)                             |
| -------------------------------------------------------- | ---------------------------------------------------- |
| About **me**, from **my own** RSI session, **right now** | Across **people**, across **devices**, over **time** |
| Scan, view, filter, export; works offline                | Orgs, member linking and consent, fleet comparisons  |
| Recent history (local cap of 100 snapshots stays)        | Unlimited history, backfill, charts over years       |
| Org Fleet file import stays as the offline option        | Every new org feature                                |

New extension features must fit the left column; anything that needs more than one
person, more than one device or long-term storage goes to the website. That keeps the
extension a scraper and viewer, and gives the site a reason to exist.

## Principles

- **Nothing syncs unless the user presses Sync.** The extension never uploads on its
  own, and the offline experience doesn't shrink.
- **Members control what their org sees** (ships only, or ships + values), and
  **Delete my account** removes everything immediately.
- **No hand-rolled security.** Auth comes from a maintained library; passwords are
  hashed by it; 2FA is TOTP with backup codes.
- **Scans stay fast** (see memory: scans-stay-fast). Sync sends what the extension
  already has; it never triggers extra RSI requests.

## Stack

| Piece                 | Choice                                                                                           | Why                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site + API            | **Astro** (server output) with the official **Cloudflare adapter**, deployed to Cloudflare Pages | Content pages (landing, ship reference) stay fast and search-friendly; logged-in pages render on the server; custom subdomain works with our Porkbun DNS (a CNAME) |
| Database              | Cloudflare **D1** (SQLite)                                                                       | Free tier covers us for a long time; bound directly to Functions                                                                                                   |
| Auth                  | **Better Auth** (open source) on D1, via its Astro integration                                   | Discord login + email/password, TOTP 2FA plugin, sessions; self-hosted, no per-user fees                                                                           |
| Email (verify, reset) | **Resend** (free tier)                                                                           | Needed for email sign-up and password resets                                                                                                                       |
| Interactive bits      | Astro **islands** in Svelte (or Preact) for charts, compare tools, filters                       | Only the interactive parts ship JavaScript; everything else is plain HTML                                                                                          |

The extension talks to the API with `fetch` from its own page; the API allows the
extension origins via CORS, so **no new install permission** is needed.

## Linking the extension to an account

Device-code flow (works on Chrome, Edge and Firefox alike):

1. Extension: Developers (later Home) → **Connect to openhangar.space** shows a short
   code, e.g. `K7Q-4PX`.
2. User signs in on the site and enters the code.
3. Extension receives a sync token (stored in `chrome.storage.local`), shown as
   "Connected as <name>" with **Disconnect**.
4. **Sync now** uploads the same payload as the JSON backup (hangar, buy-backs,
   referrals summary, history). Nothing else.

## Data model (D1)

Migrations in `app/migrations/`; the account, org and history tables are in
`0005_accounts_orgs_history.sql` (added 2026-09-30, before any real users).

- `user`, `session`, `account`, `verification`, `twoFactor`: owned by Better Auth.
  A login is **not** an RSI account.
- `rsi_account` (user_id, handle, verify_code, verified_at, last_synced_at): one
  login holds several RSI accounts (main + alts). Created unverified the first time a
  login syncs that handle. A handle can be **verified** by one login only.
- `hangar_snapshot` (rsi_account_id, synced_at, payload): latest sync per RSI account.
- `sync_token` (user_id, token_hash, label, created_at, last_used_at): one per
  connected extension. The RSI account comes from the synced data's handle.
- `org` (sid, name, logo, first_seen_at, last_active_at) and `org_membership`
  (rsi_account_id, org_sid, rank, is_main, verified_at, last_seen_at): see Orgs below.
- `share_setting` (rsi_account_id, scope org|public, level off|anon|named,
  include_values) and `consent_event` (append-only record of every change).
- `pledge_event`, `value_point`, `purchase`: see History below.
- Deleting a login deletes its RSI accounts and everything under them (tested);
  only `consent_event` rows stay, as the record of what was agreed to.
- Later: `ship_ref` etc. for reference data.

## Orgs: How Members Find Each Other

- **No org list up front.** We don't import every org in the game (heavy scraping
  that RSI's terms may not allow, and an org with no Open Hangar users has nothing to
  show). An org row appears when its first verified member syncs.
- **Verify the handle first.** Extension data can be edited, so nothing about orgs is
  taken from it. The user puts their `verify_code` (e.g. `OH-x7Qa2k`) in their public
  RSI bio once; the server reads `robertsspaceindustries.com/citizens/<handle>` and,
  if the code is there, sets `verified_at`. The code can be removed afterwards.
- **Memberships come from RSI's public pages.** On each sync of a verified account,
  the server reads the citizen's public organizations page and writes
  `org_membership` rows (main + affiliates, with rank). Hidden affiliations can't be
  verified, so they don't join.
- **Not permanent.** A membership refreshes on every sync, is removed when a sync
  shows the player left, and stops counting after 60 days without a sync.
- **Two consent settings per RSI account**, both off until the player changes them:

  | Setting             | Off         | Anonymous                                         | Named                            |
  | ------------------- | ----------- | ------------------------------------------------- | -------------------------------- |
  | **With my org**     | not counted | ships count in the org fleet as "Anonymous Pilot" | handle + ships (values optional) |
  | **With all pilots** | nothing     | counts in anonymous community stats               | public profile                   |

  Enforced in the server's queries (hidden data never reaches the page), effective
  immediately, and every change is logged in `consent_event`.

- **Small orgs:** "Anonymous Pilot owns an Idris" can identify someone. Show
  anonymous members' ships only as totals, and only when at least 3 members are
  anonymous.
- **Org admins by rank:** the highest ranks get admin tools, rank taken from RSI's
  public page, never from extension data.
- **Still no rankings:** no leaderboards of pilots or orgs, including public profiles.

## History: Forever, as Changes

- **Changes, not copies.** Each sync is diffed against the previous one (same rules as
  the extension's local history) and stored as `pledge_event` rows: added, removed
  (melted or gifted) and changed (a CCU applied keeps its pledge id). `value_point`
  keeps one point per day for charts. A hangar's history stays small for years.
- **First sync imports local history.** The extension's own history (up to 100 scan
  snapshots) comes along in the sync and becomes the starting history
  (`source = 'import'`).
- **Order history backfill** (`purchase`): a separate, opt-in button in the extension
  reads RSI's billing/order history once (never part of Scan; see scans-stay-fast).
  Only item, date, amount and RSI's label are sent and stored: never payment method,
  card details or addresses. Gives spending and fleet charts back to 2012.

## Open Questions

- Can a Cloudflare Worker read RSI's public citizen pages reliably (RSI's own bot
  protection)? Test before building verification; fallback is the extension fetching
  the public page and the server checking it with a short-lived signed request.
- Exact billing-history pages and fields on RSI (needs a look at a real account).
- The extension's backup only carries the **main** org today; affiliates come from
  the server-side page read, so no extension change is needed for orgs.

## Phases

1. **Accounts + your hangar online.** Sign up/in (Discord or email, 2FA), connect the
   extension, Sync now, view your hangar/stats on the site, export, delete account.
2. **Orgs.** Orgs form themselves from verified members (see "Orgs: How Members Find
   Each Other"): handle verification, the two consent settings, the live combined
   fleet (what Org Fleet does today with files), roles and compare views, admin tools
   by rank. Plus unlimited history and order backfill (see "History").

3. **Reference data.** Ship pages, prices, loaners and more, starcitizen.tools style,
   using the wiki API we already use.
4. **Move openhangar.space into the Astro project** so the landing page and the app
   share one codebase (GitHub Pages retired).

## Idea backlog

- **Community gallery** (after phase 1; pairs with phase 3). Logged-in players upload
  in-game screenshots, tagged by ship and location; they rotate as site backgrounds
  with credit ("📷 by <handle>"), fill a gallery page, and a full-screen "digital
  frame" mode (filter by ship). Needs: R2 storage + Cloudflare Images resizing, an
  approval queue to start (then report button), an "I took this" confirmation,
  removal requests, size/daily upload limits.

- **Org fleet builder** (phase 2). Members opt in to sharing their ships with the
  org; officers plan an outfit (e.g. a Javelin op) by roles and crew seats, add
  loadout notes (link out to Erkul), and see readiness: which roles are covered and
  by whom.
- **Org page** (phase 2): combined fleet by role, plus plain-language gaps ("no
  dedicated medical ship"). Reuses the extension's Org Fleet role logic.
- **Your profile** (phase 2, private to you): fleet by role, value, LTI share,
  rarest ship you own, fleet history graph.
- **Ship pages** (phase 3): % of synced pilots who own it, LTI rate, "often owned
  alongside". Anonymous counts only.
- **Community stats** (phase 3): pilots synced, ships tracked, most owned / rarest
  ships, ships trending up or down. Only switched on after ~100 synced pilots so
  the numbers mean something.
- **Latest news on the front page** (owner priority). The home page already shows recent
  Comm-Links; make news the lead: RSI announcements and changes players need to act on
  (e.g. the Aurora Mk I being discontinued permanently), with the date and a link to
  RSI's post. Sources to weigh: Comm-Link feed, RSI status page, patch notes.
- **Store sale history: decided no (2026-09-29).** Logging only starts the day it's
  turned on, and trackersc.com already has the past. The extension shows live "In store
  now" status instead (RSI's upgrade-tool feed), which is exact when checked.
- **No rankings, ever.** We don't rank pilots or orgs (no leaderboards, biggest
  fleets, top collections). Hangars are private by default; pooled stats are
  anonymous.

## Before sync ships to users

- Privacy policy (repo + site) rewritten for optional sync: what's stored, where
  (Cloudflare), retention, deletion.
- Store listings' privacy/data forms updated on Chrome, Edge and Firefox (new review).
- Rate limits on the API; payload size cap; token revocation.
- Fan-site notice on the site (same as openhangar.space).

## What the owner needs to do (can't be done for you)

- Approve creating the Cloudflare Pages project and D1 database.
- **Discord login:** put the application's client ID in `DISCORD_CLIENT_ID` under
  `vars` in `app/wrangler.jsonc` (it's public), and add the client secret with
  `wrangler secret put DISCORD_CLIENT_SECRET`. The button stays hidden until both are
  set. Redirects already registered: `/api/auth/callback/discord` on the live site and
  localhost:4321.
- **Email (Resend):** verify the openhangar.space domain in Resend (DNS records at
  Porkbun), then `wrangler secret put RESEND_API_KEY`. The sender is `EMAIL_FROM` in
  `wrangler.jsonc`. Without the key, verify/reset links are only logged.
- For local testing of either, add the same names to `app/.dev.vars`.
- Add the `app` CNAME at Porkbun when the site is ready.
