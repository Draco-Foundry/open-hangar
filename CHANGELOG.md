# Changelog

What's changed in each release of Open Hangar. Dates are when the version was cut.

## Unreleased

- **Hangar value shows instantly, even offline.** A copy of the ship price list now
  ships inside the extension (refreshed weekly), so Stats and store prices appear
  right away while the live list updates in the background.
- **Safer rendering.** Everything the dashboard draws now goes through an allowlist
  sanitizer, so even unexpected data from RSI or an imported file can't inject
  scripts. Firefox's add-on checker now reports zero warnings (was 26).
- **Alt accounts.** Each RSI account now keeps its own data. Sign in as a different
  account and Open Hangar sets the current one aside and loads that account's last
  scan (or asks you to scan). Switch back and everything returns. Developers has a
  **Saved accounts** list with a Remove button. Clear Data now only clears the
  account that's signed in.

## 0.2.8 — 2026-09-28

- **New Home card background.** A subtle hex-grid texture of our own replaces the
  RSI image, so the Home page no longer loads anything from RSI's media servers.
- **How-to on the Home page.** A "How to use Open Hangar" section with Getting
  started open by default, and quick guides for browsing, hangar value, selling,
  backups and getting help.
- **Shorter install warning.** Chrome now only says the extension can access
  robertsspaceindustries.com. The ship-data site it also uses is public and needs no
  special permission, so we dropped it.
- **Error report you can copy and paste.** Open Hangar now keeps a small log of
  errors, failed or partial scans and RSI retries (last 100). When something goes
  wrong, the error message has a **Copy error report** link, and Developers has the
  same button plus a preview of exactly what's in it. It includes your version,
  browser, item counts and recent errors, never your handle, referral code or item
  names. Paste it in #bug-reports on Discord or a GitHub issue (the bug form asks
  for it).
- **Suggest a feature** link in the dashboard footer, the Developers page and the
  website. It goes to the new GitHub Discussions → Ideas board, where ideas can be
  upvoted (or tell us on Discord).
- **Tidier cards.** Kind badges (SHIP / PAINT / ADDON…) are a fixed width so the
  M / G tags line up row to row; card names drop RSI's "Standalone Ships - /
  Paints - / Gear - " prefix (the badge already says it; hover for the full name);
  and the items line only lists what the name doesn't already say, so a paint
  no longer repeats its own name, and ships show just their insurance and extras.
- **Back up your history.** The JSON export (Developers → Export JSON, or the new
  **Download backup** button on Stats → History) now includes your scan history,
  and importing a backup **merges** history instead of wiping it. History keeps the
  last **100** changes (was 30). The History tab shows when you last backed up.
- Fixed: in Buy-Backs' List view, rows without an items line were shifted a column,
  stretching the kind badge across the row and squashing the date.
- **Stats is split into tabs** (Overview, Value, Fleet and History) and remembers
  the last one you opened. Home's "history" link jumps straight to History.
- **Fleet image: pick what goes on it.** Click **Select** in Inventory, pick items
  (cards, or checkboxes in Market view), give it a title and choose the price shown
  (melt value, your Market price, store price or none), then **Copy image** or
  **Save PNG**. You get a clean picture card for each item, with ship art,
  contents, insurance and giftable, ready for a sale post or a fleet share. The
  Market CSV and image exports also use your selection when there is one.
- **Melt candidates.** Stats lists pledges you could melt and buy back for the same
  store credit: meltable, no LTI, nothing but ships inside, and paid at least
  today's store price. The same list is an Inventory filter too.
- **CCU value.** Each CCU is priced at its standard value (the gap between its two
  ships), so warbond CCUs show what they saved you. CCUs also count in **Below
  store price** and appear in Stats' best deals.
- **Fleet stats.** Stats shows total cargo (SCU), crew seats, how many ships are
  flight ready, and your fleet by role and size.
- **History.** Every full scan that finds changes keeps a small snapshot in your
  browser. Home says what changed since last time (new, gone, upgraded, change
  in melt value), and Stats shows melt value over time with a log you can open
  for each scan.
- **Hangar value.** Stats has a new **Hangar value** section: what the ships in
  your hangar sell for at today's store prices, how that compares with what you
  paid, your best deals, and which ships have no public price (concept/limited).
  Prices come from star-citizen.wiki's vehicle list, which is downloaded once and
  cached for 30 days (about 6 requests, nothing per ship). Items show their store
  price in the details popup, Inventory can sort by **Store price**, and Home shows
  the total. Ships only: paints, gear, game access and CCUs aren't priced.
- **Below store price filter.** Flags ship pledges you paid less for than today's
  store price, which catches warbonds and sales even when the pledge name doesn't
  say "Warbond".
- **Exclude filters.** Click a trait filter once to include, again to exclude
  (red), a third time to clear, e.g. **Not giftable**, **Not meltable**, **No LTI**.
- "Total value" / "fleet value" are now labelled **melt value**, to tell them apart
  from store value.
- Fixed: the ship-art lookup only read the first 250 of ~300 wiki vehicles, so some
  newer ships never got a picture.
- **Hangar Transfer Format export.** New "Export HTF" button on the Developers page
  writes your fleet in the community format FleetYards and other tools import, one
  entry per ship, with ship codes, manufacturer, pledge name/date/cost, LTI and
  warbond. Special editions export as their base ship with the edition kept as the
  ship's name (e.g. a Gladius named "Gladius Dunlevy"), and ships newer than the
  bundled code list are identified from RSI's live ship matrix.
- **More Inventory filters.** Alongside Ships / CCUs / Paints / Add-ons, a second
  row of traits you can combine: **Game packages**, **Packs** (ship + paints + gear bundles), **LTI**,
  **Giftable**, **Warbond** and **Free / rewards**, e.g. Ships + LTI + Giftable.
  They sit on their own row under the main filters, and Buy-Backs gets the ones
  that apply there (Game packages, Packs, LTI, Warbond). A **Clear** button resets
  everything.
- **Meltable + giftable at a glance.** Each pledge now records whether RSI lets you
  melt it (its Exchange action) as well as gift it. Every card shows **M** and **G**
  tags (green for yes, red for no), and both show in the item details,
  **Meltable** joins the filters, and the Market view uses RSI's own answer instead
  of guessing from price.
- **Pledge dates.** Each pledge's purchase date is now read from your hangar, shown in
  the item details, and sortable in Inventory ("Pledged: newest / oldest first").
- **Sharper, faster ship images.** The blurry hover popup on inventory and buy-back
  cards is gone. Resting on a card now quietly loads a sharp 1200px image, so the
  detail view opens crisp instantly (or fades from blurry to sharp in about a
  second). Fixed PNG ship art never loading its full-size version, and switched from
  4K downloads to a right-sized image.
- **Sturdier scans.** Temporary RSI errors and rate limits are retried automatically
  with a polite backoff. If RSI keeps failing mid-scan, you keep what was gathered,
  and a partial scan never replaces a bigger earlier one.

## 0.2.7 — 2026-09-25

First store release (Chrome Web Store, Firefox Add-ons, Microsoft Edge Add-ons).

- Store-ready builds for Chrome/Edge and Firefox.
- Security hardening before review: stricter escaping of imported/third-party data,
  buy-back links restricted to robertsspaceindustries.com, and a strict content
  security policy.
- Insurance term (LTI, 120M, …), giftable status, and paint detection on pledges.
- New website: [openhangar.space](https://openhangar.space).

## 0.2.0 – 0.2.6 — June 2026

- **0.2.6** — pre-launch hardening and documentation.
- **0.2.5** — signed-out view shows your cached scan; buy-back image fixes.
- **0.2.4** — melted-CCU buy-backs show the right ship.
- **0.2.3** — list-view alignment, buy-backs sorted newest first.
- **0.2.2** — referral polish and the full event list.
- **0.2.1** — privacy policy and store launch kit.
- **0.2.0** — dedicated Referrals page with stats, charts, reward tiers and events.
