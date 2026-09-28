# Chrome Web Store — Launch Checklist & Listing

> **Submission status (2026-09-28):**
> | Store | Status | IDs / links |
> | --- | --- | --- |
> | Chrome Web Store | **live** v0.2.7 (2026-09-28); v0.2.8 to upload ( publisher `dracofoundry@gmail.com`) | item `aeabioadfphghjennmdbnpelojlhndjl` · [listing](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl) |
> | Firefox AMO | **live** v0.2.7 (2026-09-28); v0.2.8 to upload | [listing](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/) · gecko id `open-hangar@draco-foundry` |
> | Microsoft Edge | in review (~7 business days) | CRX `fmcnemfepnifokjelgjacgdhoodaiicl` · Store ID `0RDCKFFGW5QL` |
>
> When each goes live, set that button's `data-status="live"` and `data-url` in
> `site/index.html`; the "in review" line disappears once none are pending.

Everything needed to submit **Open Hangar** to the Chrome Web Store. Work top to
bottom. Items marked ✅ are ready in the repo; ⬜ need you to do them.

> See `docs/COMPLIANCE.md` for the full Compliance & Risk Statement (single purpose,
> per-permission justification, data handling, and the established-precedent peers).
> Short version: this is a well-precedented, credential-free, non-commercial,
> open-source class of tool, so a normal public listing is fine — keep the brand out
> of the title and use your own art (covered below). The statement is written to be
> pasted/linked for a reviewer if questions arise.

---

## 1. Developer account (one-time, ~30 min)

- ✅ Chrome Web Store account: `dracofoundry@gmail.com` (publisher **Draco Foundry**).
- ⬜ Public **contact email** on every store: `support@openhangar.space` (Porkbun
  forward → the maintainer's inbox). Verify it in each dashboard.

- ⬜ Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) — **$5 one-time fee**.
- ⬜ Verify the account (email + payment).
- ⬜ Consider publishing under the **Draco-Foundry** brand (group publisher) rather
  than a personal account, so it matches the GitHub org.

## 2. Package the extension

- ✅ Valid MV3 `manifest.json` (loads unpacked today).
- ✅ **`npm run pack`** builds both store zips into `dist/` (runtime files only —
  `manifest.json`, `icons/`, `src/`):
  - `open-hangar-chrome-<version>.zip` — Chrome Web Store **and** Edge Add-ons.
  - `open-hangar-firefox-<version>.zip` — Firefox AMO. `scripts/pack.mjs` adds the
    Firefox-only manifest keys (event-page `background.scripts`, gecko add-on id,
    `data_collection_permissions: none`). Validate with `npm run lint:firefox`.
- ✅ Icons: 128px declared (required). 16/32/48 also added to the manifest.

## 3. Store listing assets

- ✅ **Screenshots** (1–5 required), **1280×800** or 640×400 PNG/JPG — `docs/store-assets/screenshot-1…5-*.jpg` — regenerate with `npm run screenshots` (real UI, fictional demo account). Capture with
  real data, looking polished:
  1. Home / Citizen Card (identity + balances)
  2. Inventory (fleet gallery)
  3. Referrals page (stats + charts) — a standout, show it off
  4. Stats
  5. Developers (export/import) — signals the "data tool" angle
     Tip: a clean browser window, dark theme, no personal email visible.
- ✅ **Small promo tile**: **440×280** PNG (required) — `docs/store-assets/promo-small-440x280.png`. Can be the logo on a dark
  background. (`icons/icon.svg` + the banner in `src/assets/` are starting points.)
- ✅ (Optional) Marquee promo: 1400×560 — `docs/store-assets/promo-marquee-1400x560.png`.
- ✅ **Listing title**: `Open Hangar` (≤ 75 chars).
- ✅ **Summary / short description** (≤ 132 chars) — see §6.
- ✅ **Detailed description** — see §6.
- ⬜ **Category**: Developer Tools (fits the primary audience) or Productivity.
- ⬜ **Language**: English.

## 4. Privacy & compliance (the part that gets extensions rejected)

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

_(Since 0.2.8 there is no `api.star-citizen.wiki` host permission: that public API
sends `Access-Control-Allow-Origin: *` and we fetch it without credentials, so the
install prompt only names robertsspaceindustries.com.)_

## 6. Listing copy (ready to paste)

**Single purpose:**

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export.

**Summary (≤132 chars, also the manifest `description`):**

> Your Star Citizen hangar, made useful: ship values, melt candidates, CCU savings, fleet stats and buy-backs. Private and local.

**Detailed description:**

> Open Hangar is a free, open-source companion for your Star Citizen account. It reads
> what RSI already shows you (your hangar, buy-backs, balances, org and referrals) and
> turns it into something you can actually use.
>
> What you get:
> • Hangar value: what your ships sell for at today's store prices, and what you paid
> • Melt candidates, CCU savings, and the pledges you got for less than store price
> • Fleet stats: cargo, crew seats, roles, and how much of your fleet is flight ready
> • Filters for everything: LTI, giftable, meltable, packs, warbonds and more
> • History: see what changed since your last scan, and back it all up to a file
> • Fleet images: pick the items you want and copy a clean picture for a sale post
> • Buy-backs with direct reclaim links, and a full referrals dashboard
> • Export to JSON, or to FleetYards and other tools (Hangar Transfer Format)
>
> Private by design: it runs entirely in your browser, using the RSI session you're
> already signed in with. No password, no account, no server. Nothing leaves your
> device.
>
> MIT-licensed and open source on GitHub. Ideas and bug reports are always welcome.
>
> Unofficial and fan-made. Not affiliated with Cloud Imperium Games or RSI.

## 7. Submit & review

- ⬜ Upload zip, fill listing, set visibility to **Public** (or Unlisted if you'd
  rather soft-launch by link first — optional, not required).
- ⬜ Submit. First review with the `cookies` permission can take **several days to
  ~2 weeks**; have the §5 justifications ready in case of a clarification email.
- ⬜ Tag the release: `git tag v0.2.8 && git push origin v0.2.8`. The Release workflow builds the zips and publishes the GitHub Release with the CHANGELOG notes.

## 8. Microsoft Edge Add-ons (after Chrome — same zip)

- ✅ Register at [Partner Center → Edge](https://partner.microsoft.com/dashboard/microsoftedge/overview) — **free**.
- ✅ Upload `open-hangar-chrome-<version>.zip`; reuse the §3 assets, §5
  justifications, §6 copy, and the privacy-policy URL.
- ✅ Submitted (v0.2.7). Review is typically up to ~7 business days. Edge wants a
  300×300 logo: `docs/store-assets/logo-300.png`.

## 9. Firefox Add-ons (AMO)

- ✅ Sign in at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) — **free**.
- ✅ Upload `open-hangar-firefox-<version>.zip` as a **listed** add-on (desktop only).
- ⬜ AMO requires **source code** only for minified/bundled code — ours ships
  unminified, so none is needed.
- ⬜ Reuse the §6 copy + privacy-policy URL; category: _Other_ or _Games &
  Entertainment_.
- ⬜ Automated validation is instant; human review can follow after listing.

## 10. Safari (deferred)

Needs a Mac with Xcode and the **$99/yr** Apple Developer Program. See
CONTRIBUTING "Safari notes" — revisit after the other three stores are live.

## 11. Post-launch

- ⬜ Add the store link to the README + org profile.
- ⬜ Watch the dashboard for policy notices; respond promptly to any review query.

## 12. Publishing updates from GitHub

1. Bump `manifest.json` / `package.json`, move the CHANGELOG's Unreleased notes under
   the new version, merge, then push a tag (`git tag v0.2.9 && git push origin v0.2.9`).
   The **Release** workflow builds the zips and the GitHub Release.
2. **Actions → Publish to stores → Run workflow**, enter the tag, pick a store (or all).
   It uploads and submits for review; each store still reviews before it goes live.

A store with no secrets is skipped. Secrets (repo Settings → Secrets → Actions):
`AMO_JWT_ISSUER`, `AMO_JWT_SECRET` (set), `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`,
`EDGE_API_KEY`, `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
`CWS_REFRESH_TOKEN`.
