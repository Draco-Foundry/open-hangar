# Changelog

What's changed in each release of Open Hangar. Dates are when the version was cut.

## Unreleased — next: 0.2.8

- **Fleet image — pick what goes on it.** Click **Select** in Inventory, pick items
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
  the total. Ships only — paints, gear, game access and CCUs aren't priced.
- **Below store price filter.** Flags ship pledges you paid less for than today's
  store price, which catches warbonds and sales even when the pledge name doesn't
  say "Warbond".
- **Exclude filters.** Click a trait filter once to include, again to exclude
  (red), a third time to clear — e.g. **Not giftable**, **Not meltable**, **No LTI**.
- "Total value" / "fleet value" are now labelled **melt value**, to tell them apart
  from store value.
- Fixed: the ship-art lookup only read the first 250 of ~300 wiki vehicles, so some
  newer ships never got a picture.
- **Hangar Transfer Format export.** New "Export HTF" button on the Developers page
  writes your fleet in the community format FleetYards and other tools import — one
  entry per ship, with ship codes, manufacturer, pledge name/date/cost, LTI and
  warbond. Special editions export as their base ship with the edition kept as the
  ship's name (e.g. a Gladius named "Gladius Dunlevy"), and ships newer than the
  bundled code list are identified from RSI's live ship matrix.
- **More Inventory filters.** Alongside Ships / CCUs / Paints / Add-ons, a second
  row of traits you can combine: **Game packages**, **Packs** (ship + paints + gear bundles), **LTI**,
  **Giftable**, **Warbond** and **Free / rewards** — e.g. Ships + LTI + Giftable.
  They sit on their own row under the main filters, and Buy-Backs gets the ones
  that apply there (Game packages, Packs, LTI, Warbond). A **Clear** button resets
  everything.
- **Meltable + giftable at a glance.** Each pledge now records whether RSI lets you
  melt it (its Exchange action) as well as gift it. Every card shows **M** and **G**
  tags — green for yes, red for no — and both show in the item details,
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
  with a polite backoff. If RSI keeps failing mid-scan, you keep what was gathered —
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
