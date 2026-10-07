# Open Hangar Beta

The 0.3.0 beta ships as its own **unlisted** store item, **Open Hangar Beta**, on Chrome
and Edge. It is a separate listing from the public Open Hangar, so it never updates the
public item and testers can tell the two apart. Firefox isn't part of this beta.

Timeline: submit **Oct 13**, wave 1 tests **Oct 20 to 27**, go/no-go Oct 27, launch
**Nov 10** (launch checklist: issue #344).

## How the Beta Build Differs

| Item         | Public Open Hangar (`npm run pack`) | Open Hangar Beta (`npm run build:beta`)                 |
| ------------ | ----------------------------------- | ------------------------------------------------------- |
| Name         | Open Hangar (from `_locales`)       | Open Hangar Beta                                        |
| Icon         | blue (`icons/`)                     | amber, with a BETA tag at 48 and 128 px (`beta/icons/`) |
| Version      | `manifest.json`, e.g. 0.2.17        | `beta/beta.json`: `0.3.0.1`, shown as "0.3.0 Beta 1"    |
| Sync         | code cut out (`@sync` blocks)       | on, built in to production `app.openhangar.space`       |
| Staging site | in the manifest's website list      | nowhere: the build check fails if it shows up           |
| Permissions  | storage, unlimitedStorage, cookies  | the same plus `identity` (Connect's sign-in window)     |
| Browsers     | Chrome, Edge, Firefox               | Chrome and Edge (one zip)                               |

Chrome and Edge only take dotted numbers as a version, so the beta counts `0.3.0.1`,
`0.3.0.2`, ... and `version_name` carries the readable "0.3.0 Beta N".

## Build It

```sh
npm run build:beta
```

Builds `dist/beta/` and **`dist/open-hangar-beta-<version>.zip`** (today
`dist/open-hangar-beta-0.3.0.1.zip`): the same zip goes to Chrome and Edge. It then runs
`node scripts/check-store-build.mjs --beta`, which fails unless the zip has the beta
name, icons and version, sync built in to production only, and no staging site anywhere.
CI runs it on every PR. The public check is `npm run check:store`.

Build it from `redesign/0.3-svelte` (later `main`). Never upload this zip to the public
items, and never run the **Publish to stores** workflow for it: that workflow only knows
the public items.

Icons: edit `beta/icons/icon.svg`, then `node scripts/beta-icons.mjs` redraws the PNGs and
`beta/logo-300.png` (Edge's store logo).

## Oct 13: Submit (Owner)

Claude builds the zip and gives you its path. The text to paste is under Listing Text
below.

### Chrome Web Store

1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (Draco Foundry) →
   **New Item** → upload `open-hangar-beta-0.3.0.1.zip`.
2. **Store Listing:** description (below), category **Games**, language English. Reuse
   `docs/store-assets/screenshot-*.jpg` and `promo-small-440x280.png`.
3. **Privacy:** single purpose, one justification per permission, remote code **No**,
   data usage boxes (all below). Privacy policy URL:
   `https://app.openhangar.space/privacy`.
4. **Distribution:** visibility **Unlisted**, all regions, free.
5. **Submit for Review.** Leave publishing automatic, so it goes live once approved.

### Edge Add-ons

1. [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) →
   **Create New Extension** → upload the same zip.
2. **Availability:** visibility **Hidden** (Edge's word for unlisted), all markets.
3. **Properties:** category Entertainment, privacy policy URL as above, website
   `https://openhangar.space/`, support `support@openhangar.space`.
4. **Store Listings** (English): description (below), logo `beta/logo-300.png`, the same
   screenshots.
5. **Notes for Certification:** the reviewer notes below. Then **Publish**.

### Paste Back to Claude

1. The Chrome item ID (32 letters, on the item's page in the dashboard right after the
   upload).
2. The Edge CRX ID (Partner Center → the item → Extension Overview; it may only show
   after you press Publish).

Claude then makes one website PR: `BETA_CHROME_URL` and `BETA_EDGE_URL` in
`app/wrangler.jsonc` (the /beta page shows the buttons as soon as they're set), and both
IDs on the website's extension allowlist (`app/src/lib/cors.ts`). Without the allowlist
the beta can scan but can't Connect or sync. It needs a **production deploy before
Oct 20**, in your next batch.

## Listing Text

**Summary** (from the zip's manifest, 132 characters max):

> Beta build of Open Hangar for invited testers: your Star Citizen hangar, made useful,
> with opt-in sync to openhangar.space.

**Description:**

> Open Hangar Beta is the test flight of Open Hangar 0.3.0, for invited pilots in our
> beta program. If you weren't invited, grab the public Open Hangar instead.
>
> What's new in 0.3.0:
> • A rebuilt dashboard: Home, Inventory, Buy-Backs, Stats, Store, Org Fleet and
> Referrals
> • Optional sync to your own openhangar.space account, so your hangar is there on any
> device
> • Add to RSI Cart for ship upgrades, with RSI's own prices
>
> Everything else works like Open Hangar: it reads your own RSI account in your browser,
> using the session you're already signed in with. No password. Sync is off until you
> press Connect and sign in to openhangar.space.
>
> Please turn off the public Open Hangar while you test this one, and report bugs in
> #beta-reports on our Discord.
>
> Unofficial and fan-made. Not affiliated with Cloud Imperium Games or RSI.

**Single purpose** (from `docs/STORE.md`, plus sync):

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export, and, only
> if they connect an account, sync to their own openhangar.space account.

**Permission justifications** (from `docs/STORE.md`, with sync):

- **storage:** Stores the user's scanned hangar, buy-back and referral data and UI
  preferences locally in the browser (`chrome.storage.local`). Nothing is sent to a
  server unless the user connects an openhangar.space account.
- **unlimitedStorage:** Large hangars plus their scan history can exceed the default
  10 MB local storage quota, which would make scans fail. This only lifts the local
  size cap.
- **cookies:** Used solely to implement "Log out of RSI": clears
  robertsspaceindustries.com cookies (including the HttpOnly session cookie that page
  scripts can't remove) so the user can fully end their RSI session from the extension.
  The extension never reads cookie values or sends them anywhere.
- **identity:** Opens the browser's sign-in window (`launchWebAuthFlow`) when the user
  presses Connect, so they can sign in to their own openhangar.space account and approve
  this browser. It reads no browser or Google account data.
- **Host permission `https://robertsspaceindustries.com/*`:** The extension reads the
  signed-in user's own RSI account (hangar, buy-backs, balances, referrals) with
  same-session requests to RSI and parses them locally. Read-only and rate-limited; only
  the user's own account is accessed.

**Data usage** (only sent when the user connects and syncs):

- ☑ Personally identifiable information (RSI handle and org)
- ☑ Financial and payment information (store credit balances and pledge prices)
- ☑ Website content (hangar and buy-back contents)
- ☑ The three certifications: not sold or transferred to third parties, not used for
  anything unrelated to the item's core function, not used for creditworthiness or
  lending.

**Reviewer notes** (Edge certification notes; Chrome only asks if they email):

> Beta build of Open Hangar (public listing: Open Hangar) for invited testers. To try it,
> sign in at robertsspaceindustries.com, click the extension's icon and press Scan.
> Sync is optional: Connect needs an openhangar.space account, which is invite-only
> during the beta, and the extension works fully without it.

## How Testers Install

The /beta page (`app.openhangar.space/beta`, link shared in #beta only) has the install
buttons; these steps belong in the pinned #beta post:

1. Get your key, either one works:
   - **The Beta Tester role** in our Discord: open `app.openhangar.space/beta` and Sign In
     with Discord.
   - **An invite code** (wave invites): Create Account at `app.openhangar.space/sign-up`,
     enter the code, confirm your email, then open `app.openhangar.space/beta`. An account
     made with a code has beta access for good; a later Discord sign-in never takes it away.
2. /beta says "Welcome to the Beta, Pilot" once your key checks out.
3. **Turn off the public Open Hangar first** (`chrome://extensions` or
   `edge://extensions`, switch it off). Both would scan RSI and both answer the website,
   so testing with both on muddies every report.
4. Press **Get It for Chrome** (or Edge) and add Open Hangar Beta, the amber icon.
5. Scan once (the beta has its own local data), then Connect on the Citizen Card to try
   sync.
6. Report in #beta-reports.

When the beta ends: remove Open Hangar Beta, switch the public Open Hangar back on, and
Connect it once after it updates to 0.3.0.

If Chrome hasn't approved the item by Oct 20 (the fallback in #344), testers can load
the unzipped build unpacked. An unpacked copy gets its own ID, so it can scan but can't
Connect unless Claude pins it to the store item's ID (the dashboard's public key, in an
unpacked-only build). Ask Claude when it comes to that.

## Updates During the Beta

1. Bump `beta/beta.json`: `0.3.0.2` and "0.3.0 Beta 2" (the Beta number is always the
   fourth number; `npm test` checks it). Note the fixes in #beta.
2. `npm run build:beta`, then upload `dist/open-hangar-beta-0.3.0.2.zip`: Chrome →
   the item → **Package → Upload New Package → Submit for Review**; Edge → the item →
   **Packages → Replace → Publish**.
3. Reviews: Chrome updates usually take hours to a few days and only one version can be
   in review at a time; Edge takes up to 7 business days. Installed copies update by
   themselves within a few hours of approval.

Same rule as the public listing: at most one upload a day, and only when you say so.
Batch the daily fixes into one upload rather than chasing each.

## After Nov 10: Retire the Beta

1. Post in #beta: switch the public Open Hangar back on (it's 0.3.0 now), Connect it
   once, then remove Open Hangar Beta.
2. Chrome: the item → **Distribution → Unpublish**. Edge: the item → **Unpublish**.
   Don't delete them: the same items can carry the next beta.
3. Website: clear `BETA_CHROME_URL` and `BETA_EDGE_URL`, and around Dec 1 take the beta
   IDs off the allowlist so leftover beta copies stop syncing.
