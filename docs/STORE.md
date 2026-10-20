# Store Launch Checklist & Listing

> **Submission status (2026-10-18):**
>
> | Store            | Status                                                                                                                                                                                                                            | IDs / links                                                                                                                                |
> | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
> | Chrome Web Store | **in review** v0.5.0 (submitted 2026-10-18; v0.4.1 live) (category Games, official URL openhangar.space)                                                                                                                          | item `aeabioadfphghjennmdbnpelojlhndjl` · [listing](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl) |
> | Firefox AMO      | **in review** v0.5.0 (submitted 2026-10-18; v0.4.1 live) (AMO license field: Other, PolyForm Strict License 1.0.0, same as the repo LICENSE; privacy policy box: the 2026-10-14 policy until the owner pastes the 2026-10-18 one) | [listing](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/) · gecko id `open-hangar@draco-foundry`                              |
> | Microsoft Edge   | **in review** v0.5.0 (submitted 2026-10-18; v0.4.1 live) (category Entertainment, listing English only)                                                                                                                           | [listing](https://microsoftedge.microsoft.com/addons/detail/fmcnemfepnifokjelgjacgdhoodaiicl) · CRX `fmcnemfepnifokjelgjacgdhoodaiicl`     |
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

## 1. Accounts

Every store publishes under the **Draco Foundry** brand. The public contact on
every store is `support@openhangar.space`. The account setup is kept in the maintainer's private notes.

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
- ✅ **Single purpose** statement (dashboard asks for it): see §6.
- ✅ **Permission justifications** (dashboard requires one per permission): see §5.
- ✅ **Remote code:** "No, I am not using remote code" (flags are build-time only).
- ✅ **Data-usage disclosures** (Chrome's Privacy practices tab, filled in 2026-10-14:
  Chrome refused to submit 0.3.0 until it was). Everything stays in the browser unless
  the user connects optional sync to their own openhangar.space account; what sync
  sends is declared, the same three kinds as the Firefox build's optional
  `data_collection_permissions`:
  - ☑ Personally identifiable information (the RSI account block: handle, display
    name, avatar and profile details)
  - ☑ Financial and payment information (pledge values, store credit and other balances)
  - ☑ Website content (the hangar read from RSI's pages)
  - ☑ "I do not sell or transfer user data to third parties, outside of the approved use cases."
  - ☑ "I do not use or transfer user data for purposes that are unrelated to my item's single purpose."
  - ☑ "I do not use or transfer user data to determine creditworthiness or for lending purposes."

## 5. Permission Justifications (Paste Into the Dashboard)

As they stand in the Chrome dashboard (2026-10-14). Keep these and the dashboard the
same: change one, change the other.

**`storage`**

> Stores the user's scanned hangar, buy-back and referral data and UI preferences
> locally in the browser. Nothing leaves the browser unless the user connects optional
> sync to their own openhangar.space account.

**`unlimitedStorage`** (added in 0.2.11)

> Big hangars and buy-back lists (1,000+ items, plus scan history for the
> value-over-time chart and cached ship data) can exceed the default 10 MB local
> storage quota. unlimitedStorage lets that data stay in chrome.storage.local on the
> user's own computer. Nothing is sent to any server.

**`cookies`**

> Used for three things, all on robertsspaceindustries.com. First, "Log Out of RSI": clears RSI's cookies (including the HttpOnly session cookie that page scripts can't remove) so the user can fully end their RSI session from the extension. Second, telling whether the user is signed in to RSI: the extension checks only whether RSI's sign-in cookie exists, so the popup can show "Log In to RSI" and Auto Scan Daily can skip a signed-out day, without contacting RSI. Third, Add to RSI Cart: like RSI's own upgrade window, it reads RSI's session token cookie and sends it back to robertsspaceindustries.com with the cart request the user asked for. Cookie values are never stored and never sent anywhere except RSI.

**`identity`** (added in 0.3.0)

> Used only to get this extension's own sign-in address (chrome.identity.getRedirectURL)
> for the optional Connect to openhangar.space (an OAuth sign-in with PKCE). It never
> opens a sign-in window and never reads the user's Google or Chrome account.

**`host_permissions` → `https://robertsspaceindustries.com/*`**

> Reads the signed-in user's own RSI account (hangar, buy-backs, balances, referrals)
> with same-session requests and parses it locally, rate-limited. The only writes:
> when the user clicks Add to RSI Cart or Send to RSI Cart, it puts the items they
> picked in their own RSI cart. It never checks out or pays.

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

> Optional. Requested only when the user turns store alerts on, and the user can decline: the toolbar badge and the popup's list still work without it. Used only to show a notification when an item in RSI's store newly matches the user's hangar, buy-backs or wishlist: at most three of their own per check, then one for the rest. Matching happens on the device, and nothing is sent. Turning alerts off removes the permission.

## 6. Listing Copy (Ready to Paste)

**Single purpose** (as in the Chrome dashboard, 2026-10-14):

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data, organizes
> it into a browsable hangar they can export, and can optionally sync it to the user's
> own openhangar.space account.

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

## 7. Submit, Edge and Review

The submit and review checklist is kept in the maintainer's private notes.

## 8. Firefox Add-ons (AMO)

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

## 9. Publishing Updates

The maintainer releases (`npm run release`, then the **Publish to stores** workflow,
which waits for an approval). The release, approval and store-key steps are kept in the maintainer's private notes.

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
