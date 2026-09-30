# Changelog

What's changed in each release of Open Hangar. Dates are when the version was cut.

## Unreleased

- Citizen Card: long org names wrap to two lines at most (full name on hover), and the
  "Open Hangar vX · What's new · Star Citizen X" line moved to the page footer.
- Org Fleet: a role nobody has lists **every** ship that fills it (cheapest first, scrolling), not
  just the 10 cheapest, so big ships like the Orion show up.

- **Org Fleet roles cover every ship.** A ship now keeps every role the wiki lists, not just the
  first (the Kraken is Multi-Role and Light Carrier, so it counts as a carrier). New role groups
  for fighters, gunships, ground combat, minelaying, recovery, reporting, multi-role, starter and
  racing, named after the wiki's own roles. A test fails if any ship's role isn't placed.
- Biggest Ships sizes are capitalized (Capital, Large, …).
- Buy-back cards line up: badge and date on one row, price and Reclaim on the next, whatever the
  date's length.
- Hovering a button no longer turns it solid blue (that hid the text of outlined buttons and tabs);
  it just brightens.

## 0.2.11 — 2026-09-29

- **Org Fleet:** your own entry now follows your latest scan (Add my fleet used to be a one-off
  copy, so ships bought later never showed). A role covered only by in-concept ships (a Pioneer for
  Construction) shows in amber as covered, not missing, and the role panel lists each ship's status.
  Comparison charts draw the other side in bright white instead of grey, so it stands apart from
  your blue.
- **One color, one meaning, on every page.** Item types (ship, pack, package, CCU, paint,
  add-on, coupon) each have their own color and nothing else uses it, now also in filter chips,
  the buy-back window and Stats charts. Green is good news, amber is worth a look, red is a
  problem, blue is clickable. Balances are plain white. A **Color Key** is under How to Use on
  Home, and image exports use the same palette.
- **Home redesign bits:** a big **Global Hangar Search** sits centered under the Citizen Card
  (press / on any page to jump to it). It searches only what's yours (pledges, buy-backs, earned
  rewards), not the store. The currency picker moved to the top right of every page.
- Citizen Card tidied: balances are compact tiles with short amounts (¤ 1.2M, ¤ 90K; hover for the
  exact figure), referral and flair share one row, and the rescan reminder and Clear Data live
  under a settings button.
- After a scan, Home no longer repeats the counts above the Scan button (only problems show).
- Works on narrow windows, tablets and phones: the card stacks, the balances go 2×2, and the nav
  becomes one swipeable row.
- Fixed: pack buy-backs showed a store price far below the buy-back price because only one
  ship was priced. Now every ship in the pack counts (after Load details); before that, no
  store price is shown rather than a wrong one.
- Stats → History now charts **account value** (your ships at today's store prices) instead
  of melt value.
- **One color per type, everywhere:** ship green, CCU purple, paint pink, add-on blue, coupon
  orange, pack gold and game package teal, on badges and filter chips across Inventory,
  Buy-Backs and the wishlist. Packs and game packages in Inventory now say PACK / PACKAGE.
- Big amounts in the Home summary shorten ("CN¥13.7K") so they fit; hover for the full value.
- **This Week in Star Citizen** on Home: the newest weekly post with its picture and opening
  paragraph; "Read it on RSI" for the rest.
- Removed "melt candidates" (the Inventory filter, the Stats section and the item-window line):
  the idea that you could melt a pledge and buy it back for the same credit doesn't hold up.
- Fixed: the Scan ▾ menu was cut off by the Citizen Card; it now opens below the button.
- **A cleaner Home page.** The column of page links is gone (the top bar has them) and "How
  to Use" is one dropdown. Side by side: **Wishlist: On Sale Now** (your wishlist ships in
  RSI's store right now; hidden when your wishlist is empty) and **This Week in Star Citizen**, the
  same height; long lists scroll inside.
- **Scan → Store (wishlist)** re-checks RSI's store for your wishlist ships; untick the rest to
  check only the store.
- The scan badge by the title stays short ("Scanning…", details on hover), so it no longer
  pushes the search box onto a second line.
- Referrals: hover a dot on the reward ladders to see that tier's reward picture.
- Store searches show how many there are ("Search 221 ships…") and a live count while you
  type ("4 of 221"); the CCU search hides when you only have a few.
- **Sort your wishlist.** Name (the default), price high to low or low to high, in stock
  first, or **My order**: grab a ship and drag it; the others slide out of the way as it
  moves, and the order is saved when you let go.
- Prices no longer carry a "~". Buy-back prices that are still today's store price (until
  Load details reads RSI's exact one) say so when you hover them.
- Wishlist buy-backs include **packs that contain the ship** (e.g. a 600i inside the Origin
  Complete Pack), listed ships first, then packs, then CCUs, with a Type column. Load details
  on Buy-Backs to check every pack's contents.
- Wishlist: removing a ship is a small ✕ now, with an **Undo** bar for a few seconds in case of a misclick.
- **A tidier Store page.** Wishlist, Your CCUs and Ship Prices are now separate panels;
  long lists scroll inside their panel with their own search, and Ship Prices has tabs
  (Flight Ready, In Concept, All). Ships "in production" count as In Concept (neither can be
  flown yet).
- **In store now.** For your wishlist and in each ship's window, read from the ship's own
  page on RSI's store: "In stock" (sold on its own, with the price), "Only in a pack"
  (hover for which), or "Not in store".
- **Wishlist buy-backs.** Shows ship buy-backs and CCUs to that ship separately; click to
  see every one with its melt date, pledge ID, price and Reclaim link.
- Your CCUs lists all of them (identical ones stacked), not just ones with known prices.
- The Buy-Backs table image leaves out the "vs Store" column (it's still on screen).
- Fixed: buy-back pictures looked blurry in the details window; they now load the sharp version.
- **Wishlist.** Add ships from their details window; Store → Wishlist shows each one's
  price, whether you already own it, and any copies in your buy-backs you could reclaim
  instead. Upgrade paths link to ccugame.app.
- **Spending over time.** Stats → Spending: what you've pledged each year and the running
  total. Private, like everything else.
- **Sale heads-up.** A banner on Home while a referral bonus event is running (they come
  with IAE, Invictus, CitizenCon and the other big sales).
- **Images download.** Every picture export (Market and Buy-Backs tables, fleet image,
  referral share image) now saves a PNG instead of copying to the clipboard.
- **Global hangar search.** A search box at the top (press **/**) finds ships, your pledges
  (including what's inside them), buy-backs and referral rewards in one go.
- **Ship details.** Click any ship name (in search, pledge contents, or the Store's price
  list) for its specs, store price, which of your pledges and buy-backs have it, its
  loaners, and links to RSI, the wiki, Erkul and ccugame.
- **Loaners.** Stats → Fleet lists the loaner ships your not-yet-flyable ships give you,
  straight from RSI's Loaner Ship Matrix. Only ships you can't fly in the game yet get loaners.
  **Included Vessels** (the snubs and rovers a ship comes with for keeps, like the Carrack's
  Pisces and URSA) are listed separately, and show in each ship's window as "Comes with".
- **Check for updates.** A button on the Updates page asks the store for a new version
  right away (Chrome and Edge); Firefox gets directions, since it checks on its own.
- **Referrals, levelled up.**
  - A progress panel up top: your recruits, legacy rank, a bar to the next reward with
    an estimate at your pace, and both reward ladders as a track of lit-up dots.
  - **Share image:** one clean picture of your referral stats, progress and the ships
    you've earned, ready to paste into Discord. Tick "Include my code" to add your code
    and a QR code people can scan.
  - **Rewards Earned:** everything you've unlocked as picture cards, event bonuses included,
    each with its own picture from the Star Citizen wiki.
  - **Milestones:** when you hit each tier.
  - **Prospects:** how long people have been waiting to buy, and how fast your recruits
    bought (typical time, same day, within 30 days).
  - **Bonus events:** a banner when one is running, and the event list now refreshes
    itself from the Star Citizen wiki.
- **Land Claims get their own group.** Geotack Planetary Beacons (and Geotack-X) and
  other land claims show under Land Claims, and as "Land Claim" inside pack contents.
- Fixed: the Hangars group and Gear labels from 0.2.10 didn't show up.
- **Sturdier scans.** A hiccup from RSI or the wikis no longer overwrites good data:
  a referral list that fails keeps your last scan's, a half-downloaded ship list isn't
  saved, and failed picture lookups are retried instead of remembered. Very large
  hangars no longer hit the browser's storage limit (scan history is capped by size),
  and hangars past 2,000 pledges are read in full.
- Fixed: "10 Year" insurance showed up two ways; it's now always "120 Months".
- Fixed: importing a backup kept everything except your buy-back token count.
- Fixed: when RSI's image server drops a picture, it's retried once instead of staying
  blank until you refresh.

## 0.2.10 — 2026-09-29

- **Buy-Backs Market tools.** Like the Inventory Market: tick rows to see their total
  and how many tokens they'd use, compare with today's store price (and what you save
  once details are loaded), jot My Price / %, and Export CSV or Copy image.
- **CCUs show the ship you're upgrading to.** Cards and the details window (Inventory
  and Buy-Backs) use the destination ship's picture instead of RSI's generic upgrade art.
- **Market images are tables.** In Market view, Copy image and Save PNG make a picture of
  your picked rows as the table (grouped by section, with store price and your title),
  easy to read down; the card picture is still there in the other layouts.
- **Market: Store Price column.** Each row shows today's store price next to its melt
  price, so the gap is easy to see (also in the CSV).
- **Market: pricing ticks the row.** Typing a price or % ticks that item for export.
- **Hangars get their own group.** Pledges like VFG Industrial Hangar or Self-Land
  Hangar show under Hangars in Inventory and Market.
- **Gear is labelled.** Pack contents RSI leaves unlabelled (helmet, core, arms, legs,
  backpack…) now show as Gear, and hangars as Hangar.
- **More currencies.** Home → Currency adds NZD, CHF, SEK, PLN, CZK, BRL, CNY, JPY and KRW
  (yen and won shown without cents).
- **Store listing in 11 languages.** The extension's description now shows in your
  browser's language: 简体中文, Français, 한국어, Español, Português, Deutsch, Українська,
  Italiano, Čeština and Русский.
- **Sharp pictures right away.** Clicking an item shows its picture clearly at once
  (no blurry loading step); a higher-res copy slips in when it's ready.
- Fixed: some items (e.g. StarKitten helmets, Epoch Society shirt, AMD Never Settle
  pack, Puglisi Collection) showed no picture because RSI gave a partial image link.
  Already-scanned items are fixed too, no rescan needed.
- Fixed: some ships (e.g. Vanduul Blade, P-52 Merlin, Nox, Mustang Omega AMD Edition)
  showed a blank card when RSI's image link was broken; they now fall back to the
  ship's art from RSI's ship list. Missing-image lookups retry after a day.
- Fixed: hovering a name in the Buy-Backs table no longer covers it in a blue box.

## 0.2.9 — 2026-09-28

- **Org Fleet you can explore.** Click a role to open which ships fill it and who
  owns them; click a missing role to see ships that would fill it, cheapest first.
  Click a member to see their fleet next to the rest of the org (role and size
  charts side by side, and roles only they cover). **Compare** any two members:
  totals, charts, and which ships both own or only one does.
- **Inventory grouped by type.** Gallery, Compact and List now show Standalone
  Ships, Packs, Upgrades, Paints, Add-ons, Coupons and Other as their own sections,
  with the title pinned while you scroll. Your sort applies inside each section.
  Untick **Group by type** for one big grid.
- **More Stats.** Three new tabs. **Collection**: your insurance mix, giftable and
  meltable counts, and per manufacturer how many of their ships you own ("Origin:
  9 of 17", hover for which). **Buy-backs**: what it would cost to buy everything
  back, your tokens and the next one, the most valuable buy-backs and the ships
  you've melted most often. **Top lists**: most valuable pledges, biggest savings vs
  store price, oldest pledges and most valuable LTI ships. Click any row to open it.
- **What's in a buy-back.** Click a buy-back's name (Market) or card to see what's
  in it, read from its RSI page: every ship in a pack, the insurance, what else it
  includes, and the real buy-back price. **Load details** does the same for every
  buy-back you're looking at, one page at a time, so the Insurance and Price columns
  fill in (prices marked ~ are estimates until then). Each page is read once and
  kept.
- **Buy-backs, one row each.** The Buy-Backs Market no longer merges same-named
  buy-backs: each is its own pledge with its own insurance and extras, and each
  **Reclaim** opens that exact one (CCUs open their single buy-back entry, where
  RSI's reclaim button is). New **Packs & packages** section and an **Insurance**
  column (read from the name when RSI includes it). Add-ons such as Retaliator
  modules no longer land under Ships.
- **Insurance in List view.** Inventory's List layout has an Insurance column (LTI,
  120 Months, 6 Months, …). Insurance reads in full everywhere ("120 Months", not
  "120M"), including the Market and fleet images.
- **Your currency.** Pick USD, EUR, GBP, CAD or AUD on the Home card and every
  amount (melt value, store prices, buy-backs, org value, images) shows in it,
  converted from USD at the day's rate, before tax. Rates are public (the ECB's,
  via Frankfurter) and fetched at most once a day. My Price stays as you type it.
- **Shorter links.** Links to your RSI hangar just say **View**; every buy-back has one
  **Reclaim** link.
- **Updates page restyled.** Big version number and date, with changes grouped
  under **New & improved** and **Fixed**.
- Fixed: on narrow cards the price ran into the M / G tags; it now drops to its own
  line. The Store page's search box and ccugame.app link are styled again.
- **Org Fleet: roles, biggest ships, members.** See which jobs your org can cover
  (mining, salvage, medical, refueling, repair, exploration and more) and which it
  can't, the biggest hulls and who owns them, and each member's ship count, LTI
  count and fleet value.
- **View on RSI.** Market rows and the item details window link to the page of
  your RSI hangar that pledge is on and say where ("page 4, #3"), handy for a
  screenshot of its details. Positions come from your last scan, so rescan after
  buying or melting.
- **Buy-back tokens and prices.** Your buy-back token count (read from RSI's
  buy-back page when you scan) shows on Home and at the top of Buy-Backs, with the
  date of the next quarterly token. Buy-backs now show each ship's store price
  today (or a CCU's price gap), and you can sort **Price: high to low / low to
  high**.
- **Market: tick and price as you go.** Every Market row has a checkbox now (and
  each table a tick-all), no Select mode needed; the export count updates as you
  tick, and the image bar appears once something is picked. A new **% of Melt**
  column sits next to **My Price**: type 55 and the price fills in at 55% of melt,
  or type a price and the % works itself out. The CSV includes both.
- **Concept ships.** The ship list now includes ships that aren't flyable yet
  (Pioneer, Odyssey, Orion, …) from RSI's ship matrix, so they get a store price
  and count toward hangar value. The Store page's price list is split into
  **Flight ready** and **In concept** tables.
- **Updates page.** A new **Updates** page lists every release with its date and
  what changed (also linked from the version on Home and in the footer). When a new
  version has downloaded, a bar at the top says so with a **Reload to update**
  button, and after an update Home points you to what's new.
- **Store page.** Formerly "Store Data": every ship's store price, role, size and
  status with search, plus what each of your CCUs is worth. For planning upgrade
  chains it points you to ccugame.app, which does that job well.
- **Org Fleet.** A new page that combines your org members' ship lists into one
  fleet: every ship, who owns it, LTI count, store value, cargo, crew, and a role and
  size breakdown, with CSV export. Members share their **Export HTF** file (ships
  only); full backups work too, but only the ships are read. HTF files are now named
  with your handle so they're easy to tell apart.
- **Rescan reminder.** When your last scan is a week old, the Open Hangar toolbar icon
  shows an amber **!** (hover it to see how old). Scanning clears it; switch it off
  with **Weekly rescan reminder** on the Home card. No new permissions.
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

- **0.2.6:** pre-launch hardening and documentation.
- **0.2.5:** signed-out view shows your cached scan; buy-back image fixes.
- **0.2.4:** melted-CCU buy-backs show the right ship.
- **0.2.3:** list-view alignment, buy-backs sorted newest first.
- **0.2.2:** referral polish and the full event list.
- **0.2.1:** privacy policy and store launch kit.
- **0.2.0:** dedicated Referrals page with stats, charts, reward tiers and events.
