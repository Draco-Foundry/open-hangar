# app.openhangar.space: plan

Decided 2026-09-28. The extension stays the scraper and keeps working fully offline;
**syncing to the website is opt-in**. The website adds accounts, your hangar on any
device, orgs with live combined fleets, and (later) Star Citizen reference data.

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

- `user`, `session`, `account`, `verification`, `twoFactor`: owned by Better Auth.
- `hangar_snapshot` (user_id, synced_at, payload JSON, version): latest per user,
  plus a few older ones for history.
- `org` (id, name, rsi_sid, owner_id, invite_code), `org_member` (org_id, user_id,
  role: owner/officer/member, share: ships|ships_values|none).
- `sync_token` (user_id, token_hash, label, created_at, last_used_at).
- Later: `ship_ref` etc. for reference data.

## Phases

1. **Accounts + your hangar online.** Sign up/in (Discord or email, 2FA), connect the
   extension, Sync now, view your hangar/stats on the site, export, delete account.
2. **Orgs.** Create or join with an invite code; leaders see the live combined fleet
   (what Org Fleet does today with files), roles/compare views, member share settings.
   - **Orgs form themselves:** each sync carries the player's main org (SID) and
     rank. When members of the same org sync, its page appears; nobody has to
     create it.
   - **Public or private members:** private members' ships still count in the
     org fleet as "anonymous owner".
   - **Org admins by rank:** the highest ranks get the org's admin tools. Rank is
     checked against RSI's public org member list before granting it, because
     the extension's data could be edited.

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
- Create a **Discord application** (Developer Portal) for "Log in with Discord" and add
  its client ID/secret as Cloudflare secrets.
- Create a **Resend** account, verify the openhangar.space domain (DNS records at
  Porkbun), and add the API key as a Cloudflare secret.
- Add the `app` CNAME at Porkbun when the site is ready.
