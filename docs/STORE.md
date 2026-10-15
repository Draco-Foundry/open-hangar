# Store Launch Checklist & Listing

> **Submission status (2026-10-14):**
>
> | Store            | Status                                                                                                                                                                                              | IDs / links                                                                                                                                                      |
> | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | Chrome Web Store | **live** v0.3.0; **v0.4.1 in review** (submitted 2026-10-14; the 0.3.1 and 0.4.0 reviews were cancelled for it; category Games, official URL openhangar.space) (publisher `[email removed]`) | item `aeabioadfphghjennmdbnpelojlhndjl` · [listing](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl)                       |
> | Firefox AMO      | **live** v0.4.0; v0.4.1 submitted 2026-10-14 (AMO license field All Rights Reserved (repo LICENSE: PolyForm Strict 1.0.0))                                                                          | [listing](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/) · gecko id `open-hangar@draco-foundry`                                                    |
> | Microsoft Edge   | **live** v0.2.19; **v0.4.1 in review** (submitted 2026-10-14; the 0.3.0 and 0.4.0 reviews were cancelled; category Entertainment, listing English only)                                             | [listing](https://microsoftedge.microsoft.com/addons/detail/fmcnemfepnifokjelgjacgdhoodaiicl) · CRX `fmcnemfepnifokjelgjacgdhoodaiicl` · Store ID `[id removed]` |
>
> When each goes live, set that button's `data-status="live"` and `data-url` in
> `site/index.html`; the "in review" line disappears once none are pending.
>
> This table is the single source of truth for store status. Other docs link here
> instead of repeating it.
>
> The unlisted **Open Hangar Beta** items (0.3.0 beta, separate from these listings):
> [BETA.md](BETA.md).

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

- ✅ Chrome Web Store account: `[email removed]` (publisher **Draco Foundry**).
- ⬜ Public **contact email** on every store: `support@openhangar.space` (Porkbun
  forward → the maintainer's inbox). Verify it in each dashboard.

- ✅ Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole): **$5 one-time fee**.
- ✅ Verify the account (email + payment).
- ✅ Publish under the **Draco Foundry** brand rather than a personal account, so it
  matches the GitHub org.

## 2. Package the Extension

- ✅ Valid MV3 `manifest.json` (loads unpacked today).
- ✅ **`npm run pack`** builds both store zips into `dist/` (runtime files only:
  `manifest.json`, `_locales/` (English only), `icons/`, the connector's part of `src/`,
  plus `LICENSE` and `THIRD_PARTY_NOTICES.md`; the dashboard and `CHANGELOG.md` stay
  out, docs/CONNECTOR.md):
  - `open-hangar-chrome-<version>.zip`: Chrome Web Store **and** Edge Add-ons.
  - `open-hangar-firefox-<version>.zip`: Firefox AMO. `scripts/pack.mjs` adds the
    Firefox-only manifest keys (event-page `background.scripts`, gecko add-on id,
    `data_collection_permissions` (none required; what sync sends optional, asked on
    the first Connect), and `gecko_android` for Firefox for Android 142+). Validate
    with `npm run lint:firefox`.
- ✅ Icons: 128px declared (required). 16/32/48 also added to the manifest.

## 3. Store Listing Assets

- ✅ **Screenshots** (1–5 required), **1280×800** or 640×400 PNG/JPG, from 0.4.0 the
  toolbar popup's (real UI, fictional demo account), with their AMO captions:
  1. Hangar: `docs/store-assets/screenshot-040-1-hangar.jpg`, "Your hangar at a glance:
     portrait, Account Value, Store Credit, Fleet News and Scan."
  2. Wishlist: `docs/store-assets/screenshot-040-2-wishlist.jpg`, "Add to your Wishlist
     right from the popup." (retaken for 0.4.1, with no Target Price)
  3. Settings: `docs/store-assets/screenshot-040-3-settings.jpg`, "Every setting in one
     place, including Auto Scan Daily."
  4. Alerts: `docs/store-assets/screenshot-040-4-alerts.jpg`, "Store alerts for your
     ships and your Wishlist."
  5. Light mode: `docs/store-assets/screenshot-040-5-light.jpg`, "Light mode, or follow
     your browser."

  The 0.3.0 `screenshot-connector-*` files show the old popup and the basic page's
  lists, which 0.4.0 removed, and the older `screenshot-1…5-*` files
  (`npm run screenshots`) show the dashboard, which store builds don't have: don't
  upload either.

- ✅ **Small promo tile**: **440×280** PNG (required) — `docs/store-assets/promo-small-440x280.png`. Can be the logo on a dark
  background. (`icons/icon.svg` + the banner in `src/assets/` are starting points.)
- ✅ (Optional) Marquee promo: 1400×560 — `docs/store-assets/promo-marquee-1400x560.png`.
- ✅ **Privacy policy as plain text**: `docs/store-assets/privacy-plain.txt`, generated from `docs/PRIVACY.md` by `npm run privacy:plain` (`npm test` fails while they differ).
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

## 5. Permission Justifications (Paste Into the Dashboard)

**`storage`**

> Stores the user's scanned hangar/buy-back/referral data and UI preferences
> locally in the browser (`chrome.storage.local`). Nothing is sent to any server.

**`unlimitedStorage`** (added in 0.2.11)

> Large hangars plus their scan history (used for "what changed since last scan")
> can exceed the default 10 MB local storage quota, which would make scans fail.
> All data stays on the user's device; this only lifts the local size cap.

**`cookies`**

> Used for three things, all on robertsspaceindustries.com. First, "Log Out of RSI": clears RSI's cookies (including the HttpOnly session cookie that page scripts can't remove) so the user can fully end their RSI session from the extension. Second, telling whether the user is signed in to RSI: the extension checks only whether RSI's sign-in cookie exists, so the popup can show "Log In to RSI" and Auto Scan Daily can skip a signed-out day, without contacting RSI. Third, Add to RSI Cart: like RSI's own upgrade window, it reads RSI's session token cookie and sends it back to robertsspaceindustries.com with the cart request the user asked for. Cookie values are never stored and never sent anywhere except RSI.

**`host_permissions` → `https://robertsspaceindustries.com/*`**

> The extension reads the signed-in user's OWN RSI account (hangar, buy-backs,
> balances, referrals) by making same-session `fetch` requests to RSI, then parses
> the returned pages/JSON locally. Read-only and rate-limited; only the user's own
> account is accessed.

_(Since 0.2.8 there is no `api.star-citizen.wiki` host permission: that public API
sends `Access-Control-Allow-Origin: *` and we fetch it without credentials, so the
install prompt only names robertsspaceindustries.com.)_

**`identity`** (added in 0.3.0)

> Used only for the optional Connect to openhangar.space, an OAuth sign-in with PKCE. It gets this extension's own sign-in address (chrome.identity.getRedirectURL) and opens a sign-in window for app.openhangar.space (chrome.identity.launchWebAuthFlow), where the user signs in and approves the connection. The window hands the extension a one-time code, never the user's password. It never reads the user's Google or Chrome account.

**`alarms`** (added in 0.3.0)

> Used only for two optional features, both off until the user turns them on in the extension's settings. Store alerts: the alarm wakes the extension for a check at most every 30 minutes. It downloads one public sale file from openhangar.space (the same file for everyone, with nothing about the user in the request), reads the user's own Wishlist if they connected openhangar.space, and matches both on the device. Auto Scan Daily (only while connected to openhangar.space): the alarm wakes the extension once a day to scan the user's own RSI account, the same as pressing Scan, and only when the signed-in RSI account is the connected one. Turning a feature off clears its alarm.

**`offscreen`** (added in 0.4.0; Chrome and Edge only)

> Used only to run the hangar scan in a hidden page instead of opening a tab. The scan reads the signed-in user's own RSI pages and parses their HTML with DOMParser, which the extension's service worker doesn't have (reason: DOM_PARSER). The hidden page reads nothing beyond what the user's Scan already reads from robertsspaceindustries.com.

**`notifications`** (optional, added in 0.3.0)

> Optional. Requested only when the user turns store alerts on, and the user can decline: the toolbar badge and the popup's list still work without it. Used only to show a notification when an item in RSI's store newly matches the user's hangar, buy-backs or wishlist, at most three per check. Matching happens on the device, and nothing is sent. Turning alerts off removes the permission.

## 6. Listing Copy (Ready to Paste)

**Single purpose:**

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export.

**Summary (≤132 chars, also the manifest `description`):**

> Scan your Star Citizen hangar in one click, see it all on openhangar.space and get store alerts. Private, with no account needed.

Only `_locales/en` ships since 0.4.0 (#685), so the stores list English only. A
language comes back with its real translation.

**Detailed description** (from 0.4.0):

The store fields are plain text: paste it without the `>` quote marks and the `**` bold
markers, with each paragraph and each • bullet on one line.

> **Your Star Citizen hangar, one click away.**
>
> Open Hangar reads your pledges, buy-backs, balances and referrals from RSI with the session you're already signed in with, and shows them in a popup and on our hangar page. Free, no password, no account needed.
>
> What you get:
> • Scan: one click reads your hangar and buy-backs from RSI. It runs in the background, with no tab to open
> • The toolbar popup: your hangar at a glance, Fleet News, your Wishlist and every setting, in three tabs
> • Your full hangar at hangar.openhangar.space: pledges, buy-backs, fleet stats, values, referrals and more, read from this browser, with no account
> • Store alerts (optional): a badge and a notification when a ship in your buy-backs is back in the store, or a ship you own gets a new paint, a warbond edition or a limited-time sale. Matched on your device
> • Add to RSI Cart: put a ship upgrade (CCU) in your RSI cart in one click. You always check out on RSI yourself
> • Backups: save your hangar as a JSON or CSV file any time
> • With openhangar.space connected: edit your Wishlist from the popup, and turn on Auto Scan Daily to check your hangar once a day, only for the RSI account you connected
>
> **Open beta:** this is Open Hangar 0.4, and it's all yours now. Syncing your hangar to openhangar.space opens to everyone at our official launch on November 10.
>
> **Private by design:** Open Hangar runs in your browser, using the RSI session you're already signed in with. It never asks for your password. Your hangar stays on your device, and nothing about you is sent to us unless you connect.
>
> The extension is source available on GitHub. Ideas and bug reports are always welcome.
>
> Unofficial and fan-made. Not affiliated with Cloud Imperium Games or RSI. Fly safe, o7.

**Once Send to RSI Cart is open to everyone on openhangar.space's store,** switch the cart
bullet above to this one:

> • Add to RSI Cart and Send to RSI Cart: put the upgrades and store items you pick in your RSI cart in one click. You always check out on RSI yourself

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

## 10. Post-Launch

- ✅ Add the store links to the README. ⬜ Org profile.
- ⬜ Watch the dashboard for policy notices; respond promptly to any review query.

## 11. Publishing Updates From GitHub

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

### Holding a Store Back

When a version goes to some stores but one waits a day on purpose, the extension page
can say so with the same yellow pill as "in review", e.g. Firefox `v0.2.19` and
`v0.2.20 arriving Oct 7`:

1. Edit `site/store-plan.json` on `main` (chrome, edge or firefox; the date is the UTC
   day you plan to publish):

   ```json
   { "firefox": { "version": "0.2.20", "on": "2026-10-07" } }
   ```

2. Merge it. That deploys the site (owner OK needed), and the hourly site runs keep it
   up to date.
3. Nothing to undo: the pill goes by itself once that store goes to review ("in
   review" replaces it), has the version live, or the UTC day is over. Set the file
   back to `{}` when convenient.

A typo (bad version or date, unknown store) just shows no pill. The pill only appears
while the store's live version can be read and is older.

## 12. Store Keys

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
