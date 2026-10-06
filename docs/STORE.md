# Store Launch Checklist & Listing

> **Submission status (2026-09-30):**
>
> | Store            | Status                                                                                                                                                                                    | IDs / links                                                                                                                                                      |
> | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | Chrome Web Store | **live** v0.2.11; **v0.2.12 in review** (submitted 2026-09-30, new listing: description, screenshots, category Games, official URL openhangar.space) (publisher `dracofoundry@gmail.com`) | item `aeabioadfphghjennmdbnpelojlhndjl` · [listing](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl)                       |
> | Firefox AMO      | **live** v0.2.12 (approved 2026-09-30; new listing, screenshots, AMO license field All Rights Reserved (repo LICENSE: PolyForm Strict 1.0.0), privacy policy 2026-09-30)                  | [listing](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/) · gecko id `open-hangar@draco-foundry`                                                    |
> | Microsoft Edge   | v0.2.12 in review with the new listing (resubmitted 2026-09-30, category Entertainment, test notes for reviewers)                                                                         | [listing](https://microsoftedge.microsoft.com/addons/detail/fmcnemfepnifokjelgjacgdhoodaiicl) · CRX `fmcnemfepnifokjelgjacgdhoodaiicl` · Store ID `0RDCKFFGW5QL` |
>
> When each goes live, set that button's `data-status="live"` and `data-url` in
> `site/index.html`; the "in review" line disappears once none are pending.
>
> This table is the single source of truth for store status. Other docs link here
> instead of repeating it.

Everything needed to submit **Open Hangar** to the Chrome Web Store, Edge Add-ons and
Firefox Add-ons. Work top to bottom. Items marked ✅ are ready in the repo; ⬜ need you to do them.

> See `docs/COMPLIANCE.md` for the full Compliance & Risk Statement (single purpose,
> per-permission justification, data handling, and the established-precedent peers).
> Short version: this is a well-precedented, credential-free, non-commercial class of
> tool, and ours is source-available, so a normal public listing is fine — keep the brand out
> of the title and use your own art (covered below). The statement is written to be
> pasted/linked for a reviewer if questions arise.

---

## 1. Developer Account (One-Time, ~30 Min)

- ✅ Chrome Web Store account: `dracofoundry@gmail.com` (publisher **Draco Foundry**).
- ⬜ Public **contact email** on every store: `support@openhangar.space` (Porkbun
  forward → the maintainer's inbox). Verify it in each dashboard.

- ✅ Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole): **$5 one-time fee**.
- ✅ Verify the account (email + payment).
- ✅ Publish under the **Draco Foundry** brand rather than a personal account, so it
  matches the GitHub org.

## 2. Package the Extension

- ✅ Valid MV3 `manifest.json` (loads unpacked today).
- ✅ **`npm run pack`** builds both store zips into `dist/` (runtime files only:
  `manifest.json`, `_locales/`, `icons/`, `src/`, plus `CHANGELOG.md`, `LICENSE` and
  `THIRD_PARTY_NOTICES.md`):
  - `open-hangar-chrome-<version>.zip`: Chrome Web Store **and** Edge Add-ons.
  - `open-hangar-firefox-<version>.zip`: Firefox AMO. `scripts/pack.mjs` adds the
    Firefox-only manifest keys (event-page `background.scripts`, gecko add-on id,
    `data_collection_permissions: none`, and `gecko_android` for Firefox for Android
    142+). Validate with `npm run lint:firefox`.
- ✅ Icons: 128px declared (required). 16/32/48 also added to the manifest.

## 3. Store Listing Assets

- ✅ **Screenshots** (1–5 required), **1280×800** or 640×400 PNG/JPG: `docs/store-assets/screenshot-1…5-*.jpg`. Regenerate with `npm run screenshots` (real UI, fictional demo account):
  1. Inventory (fleet gallery)
  2. Home
  3. Referrals page (stats + charts)
  4. Buy-backs
  5. Stats
- ✅ **Small promo tile**: **440×280** PNG (required) — `docs/store-assets/promo-small-440x280.png`. Can be the logo on a dark
  background. (`icons/icon.svg` + the banner in `src/assets/` are starting points.)
- ✅ (Optional) Marquee promo: 1400×560 — `docs/store-assets/promo-marquee-1400x560.png`.
- ✅ **Listing title**: `Open Hangar` (≤ 75 chars).
- ✅ **Summary / short description** (≤ 132 chars) — see §6.
- ✅ **Detailed description** — see §6.
- ✅ **Category**: Games on Chrome, Entertainment on Edge (see the status table).
- ⬜ **Language**: English.

## 4. Privacy & Compliance (the Part That Gets Extensions Rejected)

- ✅ **Privacy policy hosted** — paste this URL in each store dashboard:
  **`https://openhangar.space/privacy.html`** (source: `site/privacy.html`, mirrors
  `docs/PRIVACY.md`). Homepage / support URL: `https://openhangar.space/`.
- ⬜ **Single purpose** statement (dashboard asks for it): see §6.
- ⬜ **Permission justifications** (dashboard requires one per permission): see §5.
- ⬜ **Data-usage disclosures** (checkboxes in the dashboard):
  - Data collected: only the user's own RSI account data, stored **locally**.
  - ☑ "I do not sell or transfer user data to third parties."
  - ☑ "I do not use/transfer data for purposes unrelated to the item's core function."
  - ☑ "I do not use/transfer data to determine creditworthiness / for lending."
  - Local-only with no server is a strong position — state it plainly.

## 5. Permission Justifications (Paste Into the Dashboard)

**`storage`**

> Stores the user's scanned hangar/buy-back/referral data and UI preferences
> locally in the browser (`chrome.storage.local`). Nothing is sent to any server.

**`unlimitedStorage`** (added in 0.2.11)

> Large hangars plus their scan history (used for "what changed since last scan")
> can exceed the default 10 MB local storage quota, which would make scans fail.
> All data stays on the user's device; this only lifts the local size cap.

**`cookies`**

> Used solely to implement "Log out of RSI": clears robertsspaceindustries.com
> cookies (including the HttpOnly session cookie that page scripts can't remove) so
> the user can fully end their RSI session from the extension. The extension never
> reads cookie values or sends them anywhere.

**`host_permissions` → `https://robertsspaceindustries.com/*`**

> The extension reads the signed-in user's OWN RSI account (hangar, buy-backs,
> balances, referrals) by making same-session `fetch` requests to RSI, then parses
> the returned pages/JSON locally. Read-only and rate-limited; only the user's own
> account is accessed.

_(Since 0.2.8 there is no `api.star-citizen.wiki` host permission: that public API
sends `Access-Control-Allow-Origin: *` and we fetch it without credentials, so the
install prompt only names robertsspaceindustries.com.)_

## 6. Listing Copy (Ready to Paste)

**Single purpose:**

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export.

**Summary (≤132 chars, also the manifest `description`):**

> Your Star Citizen hangar, made useful: ship values, melt candidates, CCU savings, fleet stats and buy-backs. Private and local.

**Detailed description:**

> Open Hangar is a free companion for your Star Citizen account. It reads what RSI
> already shows you (your hangar, buy-backs, balances, org and referrals) and turns it
> into something you can actually use.
>
> What you get:
> • A clean home page: your account value and how it's changed over time, game
> status and events, your newest pledges, and the latest from RSI
> • Hangar value: what your ships sell for at today's store prices, next to their
> melt value
> • Hangar alerts: a wishlist ship on sale, a ship you own turning flight ready, and more
> • Search your whole hangar, buy-backs and rewards from any page
> • Melt planner: pick pledges and see what their melt value buys from your wishlist
> • Filters for everything, plus saved views: LTI, giftable, meltable, packs, below
> store price and more
> • Fleet stats: cargo, crew seats, roles, and how much of your fleet is flight ready
> • Buy-backs with direct reclaim links, and a full referrals dashboard
> • Streamer Mode hides your money amounts for streams and screenshots
> • History: see what changed since your last scan, and back it all up to a file
> • Export to CSV, JSON, or FleetYards and other tools (Hangar Transfer Format)
>
> Private by design: it runs entirely in your browser, using the RSI session you're
> already signed in with. No password, no account, no server. Nothing leaves your
> device.
>
> Source available on GitHub. Ideas and bug reports are always welcome.
>
> Unofficial and fan-made. Not affiliated with Cloud Imperium Games or RSI.

## 7. Submit & Review

- ✅ Upload zip, fill listing, set visibility to **Public**.
- ✅ Submit. First review with the `cookies` permission can take **several days to
  ~2 weeks**; have the §5 justifications ready in case of a clarification email.
- ✅ Tag the release: `git tag v0.2.8 && git push origin v0.2.8`. The Release workflow builds the zips and publishes the GitHub Release with the CHANGELOG notes.

## 8. Microsoft Edge Add-ons (After Chrome, Same Zip)

- ✅ Register at [Partner Center → Edge](https://partner.microsoft.com/dashboard/microsoftedge/overview) — **free**.
- ✅ Upload `open-hangar-chrome-<version>.zip`; reuse the §3 assets, §5
  justifications, §6 copy, and the privacy-policy URL.
- ✅ Live; current version and review state are in the status table at the top. Review
  is typically up to ~7 business days. Edge wants a 300×300 logo:
  `docs/store-assets/logo-300.png`.

## 9. Firefox Add-ons (AMO)

- ✅ Sign in at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) — **free**.
- ✅ Upload `open-hangar-firefox-<version>.zip` as a **listed** add-on. The manifest
  declares both desktop Firefox (140+) and Firefox for Android (142+, `gecko_android` in
  `scripts/pack.mjs`).
- ✅ AMO needs the **source code**, because the Svelte UI is compiled with Vite. The
  Publish workflow attaches the tag's source to every upload, and
  [AMO-SOURCE.md](AMO-SOURCE.md) tells reviewers how to rebuild it.
- ✅ Reuse the §6 copy + privacy-policy URL; category: _Other_ or _Games &
  Entertainment_.
- ✅ Automated validation is instant; human review can follow after listing.

## 10. Safari (Deferred)

Needs a Mac with Xcode and the **$99/yr** Apple Developer Program. See
CONTRIBUTING "Safari Notes". The other three stores are live, so this is the one left.

## 11. Post-Launch

- ✅ Add the store links to the README. ⬜ Org profile.
- ⬜ Watch the dashboard for policy notices; respond promptly to any review query.

## 12. Publishing Updates From GitHub

1. `npm run release <x.y.z>` on a clean `main` (or bump `manifest.json` /
   `package.json`, move the CHANGELOG's Unreleased notes under the new version, merge,
   and push a tag). The **Release** workflow builds the zips and the GitHub Release,
   then starts **Publish to stores** for the tag with `store: all`.
2. That run checks everything, waits for CI on the release commit to pass, then each
   upload job waits for you to **Approve** the `stores` environment in the run
   (Review deployments). It uploads and submits for review; each store still reviews
   before it goes live. To publish one store or retry, run **Actions → Publish to
   stores → Run workflow** by hand with the tag and a store.

Picking a single store whose secrets aren't set skips it; picking **all** fails
instead, so Discord never announces a store that got nothing. See Store Keys below for
the secrets.

One store update a day: a real run fails if another one sent something to the stores
in the last 24 hours, unless it finishes the same tag one store at a time or the
**Hotfix** box is ticked ([ROLLBACK.md](ROLLBACK.md)).

## 13. Store Keys

The upload keys are secrets in the `stores` environment (repo Settings → Environments →
stores), which needs your approval before any job can read them (#192). Keys not moved
there yet still work from repo Settings → Secrets → Actions. `DISCORD_UPDATES_WEBHOOK`
stays at repo level.

**Save every key in Bitwarden the moment you create it.** GitHub never shows a secret
again, and most of these are only shown once by the store too, so a key that isn't saved
can only be replaced, not recovered.

| Secret              | Where it comes from                                                                           | Shown again? |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `AMO_JWT_ISSUER`    | addons.mozilla.org → Developer Hub → Manage API Keys (`user:…`)                               | Yes          |
| `AMO_JWT_SECRET`    | Same page, when you generate credentials                                                      | No           |
| `EDGE_PRODUCT_ID`   | Partner Center → Microsoft Edge → Open Hangar → Extension overview (a GUID, not the store ID) | Yes          |
| `EDGE_CLIENT_ID`    | Partner Center → Microsoft Edge → Publish API                                                 | Yes          |
| `EDGE_API_KEY`      | Same page, Create API credentials                                                             | No           |
| `CWS_EXTENSION_ID`  | `aeabioadfphghjennmdbnpelojlhndjl` (public, from the store link)                              | Yes          |
| `CWS_CLIENT_ID`     | Google Cloud Console → APIs & Services → Credentials → the OAuth client                       | Yes          |
| `CWS_CLIENT_SECRET` | Same client, Add secret                                                                       | No           |
| `CWS_REFRESH_TOKEN` | OAuth Playground (below)                                                                      | No           |

**Regenerating revokes the old key.** AMO and Edge keys stop working the moment new ones
are made, so update the secret straight away. A Google client can hold two secrets at
once: add the new one, confirm a Chrome upload works, then delete the old one.

**Expiry.** Edge API keys expire; Partner Center shows the date. Put it in the Bitwarden
note and renew before it lapses. Google refresh tokens expire after 7 days if the OAuth
consent screen is in **Testing**, so keep it **In production** (APIs & Services → OAuth
consent screen → Publish app). It's only your own tool, so no Google review is needed.

**New Chrome refresh token:**

1. On the OAuth client (a Web application), add the redirect URI
   `https://developers.google.com/oauthplayground`.
2. Open developers.google.com/oauthplayground → gear icon → Use your own OAuth
   credentials, and paste the client ID and secret.
3. Step 1: scope `https://www.googleapis.com/auth/chromewebstore` → Authorize APIs, and
   sign in with the Google account that owns the Chrome Web Store listing.
4. Step 2: Exchange authorization code for tokens, and copy the refresh token into
   Bitwarden and into `CWS_REFRESH_TOKEN`.
