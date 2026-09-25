# Changelog

What's changed in each release of Open Hangar. Dates are when the version was cut.

## Unreleased — next: 0.2.8

- **Hangar Transfer Format export.** New "Export HTF" button on the Developers page
  writes your fleet in the community format FleetYards and other tools import — one
  entry per ship, with ship codes, manufacturer, pledge name/date/cost, LTI and
  warbond. Special editions export as their base ship with the edition kept as the
  ship's name (e.g. a Gladius named "Gladius Dunlevy"), and ships newer than the
  bundled code list are identified from RSI's live ship matrix.
- **More Inventory filters.** Alongside Ships / CCUs / Paints / Add-ons, a second
  row of traits you can combine: **Game packages**, **Packs** (ship + paints + gear bundles), **LTI**,
  **Giftable**, **Warbond** and **Free / rewards** — e.g. Ships + LTI + Giftable.
  A **Clear** button resets everything.
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
