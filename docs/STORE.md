# Chrome Web Store — Launch Checklist & Listing

Everything needed to submit **Open Hangar** to the Chrome Web Store. Work top to
bottom. Items marked ✅ are ready in the repo; ⬜ need you to do them.

> See `docs/RSI-TOS-RISK.md` for CIG/RSI compliance notes — short version: this is a
> well-precedented class of tool (CCUGame et al.), non-commercial and
> credential-free, so a normal public listing is fine. Just keep the brand out of
> the title and use your own art (already covered below).

---

## 1. Developer account (one-time, ~30 min)

- ⬜ Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) — **$5 one-time fee**.
- ⬜ Verify the account (email + payment).
- ⬜ Consider publishing under the **Draco-Foundry** brand (group publisher) rather
  than a personal account, so it matches the GitHub org.

## 2. Package the extension

- ✅ Valid MV3 `manifest.json` (loads unpacked today).
- ⬜ **Zip the extension** for upload. Include only runtime files — NOT
  `node_modules/`, `test/`, `docs/`, `.git/`, `.github/`, dotfiles. Suggested zip
  contents:
  ```
  manifest.json
  icons/            (icon16, icon32, icon48, icon128 .png)
  src/              (background.js, dashboard.html, dashboard.js, lib.js, scraper/, assets/)
  ```
  (A `scripts/pack.*` helper to produce this zip is a nice future addition — see TODO.)
- ✅ Icons: 128px declared (required). 16/32/48 also added to the manifest.

## 3. Store listing assets

- ⬜ **Screenshots** (1–5 required), **1280×800** or 640×400 PNG/JPG. Capture with
  real data, looking polished:
  1. Home / Citizen Card (identity + balances)
  2. Inventory (fleet gallery)
  3. Referrals page (stats + charts) — a standout, show it off
  4. Stats
  5. Developers (export/import) — signals the "data tool" angle
     Tip: a clean browser window, dark theme, no personal email visible.
- ⬜ **Small promo tile**: **440×280** PNG (required). Can be the logo on a dark
  background. (`icons/icon.svg` + the banner in `src/assets/` are starting points.)
- ⬜ (Optional) Marquee promo: 1400×560.
- ✅ **Listing title**: `Open Hangar` (≤ 75 chars).
- ✅ **Summary / short description** (≤ 132 chars) — see §6.
- ✅ **Detailed description** — see §6.
- ⬜ **Category**: Developer Tools (fits the primary audience) or Productivity.
- ⬜ **Language**: English.

## 4. Privacy & compliance (the part that gets extensions rejected)

- ⬜ **Host a privacy policy** and paste its URL in the dashboard. Ready-to-publish
  text is in `docs/PRIVACY.md` — host it via GitHub Pages or link the raw file.
- ⬜ **Single purpose** statement (dashboard asks for it): see §6.
- ⬜ **Permission justifications** (dashboard requires one per permission): see §5.
- ⬜ **Data-usage disclosures** (checkboxes in the dashboard):
  - Data collected: only the user's own RSI account data, stored **locally**.
  - ☑ "I do not sell or transfer user data to third parties."
  - ☑ "I do not use/transfer data for purposes unrelated to the item's core function."
  - ☑ "I do not use/transfer data to determine creditworthiness / for lending."
  - Local-only with no server is a strong position — state it plainly.

## 5. Permission justifications (paste into the dashboard)

**`storage`**

> Stores the user's scanned hangar/buy-back/referral data and UI preferences
> locally in the browser (`chrome.storage.local`). Nothing is sent to any server.

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

**`host_permissions` → `https://api.star-citizen.wiki/*`**

> Public, read-only API used to fetch the current game version and ship images for
> items RSI ships without art. No credentials or personal data are sent.

## 6. Listing copy (ready to paste)

**Single purpose:**

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export.

**Summary (≤132 chars):**

> Read your own Star Citizen / RSI hangar, buy-backs, balances & referrals into a
> clean, local, exportable database.

**Detailed description:**

> Open Hangar is an open-source companion for your Star Citizen / RSI account. It
> reads what RSI already shows you — your hangar (ships, CCUs, add-ons), buy-backs,
> account balances, org & rank, and referral recruits/prospects — and saves it as
> clean, structured data on your own machine.
>
> • Runs entirely in your browser. No password, no server, nothing leaves your
> device — it uses the RSI session you're already signed in with.
> • Browse your fleet with search, sort, and filters; see stats and breakdowns.
> • A full Referrals page: recruits, prospects, conversion stats, reward tiers, and
> event bonuses.
> • Export your whole database as one JSON file to back it up or build on it.
>
> Built for developers as a reusable data layer, and for fans who just want a
> friendly way to browse their hangar. MIT-licensed and fully auditable on GitHub.
>
> Unofficial, fan-made, and not affiliated with Cloud Imperium Games or RSI.

## 7. Submit & review

- ⬜ Upload zip, fill listing, set visibility to **Public** (or Unlisted if you'd
  rather soft-launch by link first — optional, not required).
- ⬜ Submit. First review with the `cookies` permission can take **several days to
  ~2 weeks**; have the §5 justifications ready in case of a clarification email.
- ⬜ After approval, tag the release (e.g. `git tag v0.2.1 && git push origin v0.2.1`)
  and draft a GitHub Release.

## 8. Post-launch

- ⬜ Add the store link to the README + org profile.
- ⬜ Watch the dashboard for policy notices; respond promptly to any review query.
