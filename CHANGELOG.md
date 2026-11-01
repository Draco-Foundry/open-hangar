# Changelog

What's changed in each release of Open Hangar. Dates are when the version was cut.

## Unreleased
n- Changed: the popup's Connected row is less busy. The sync time sits under it, Sync Now stays on the right, and Disconnect moves down beside Clear Data.

## 0.5.7 — 2026-10-31

- Changed: Account Value no longer adds in your Store Credit, so it matches the website. Store Credit still shows on its own.
- Fixed: **The Wishlist search lists one row per ship.** A ship the lists spell two ways shows once, and ships nobody can get from RSI anymore (the AMD package, in-game rewards, retired ships) are no longer offered. One already on your Wishlist stays and says it isn't for sale.

## 0.5.6 — 2026-10-31

- Fixed: **A first scan that stops partway.** It no longer keeps the part it read, so only a whole hangar is ever saved or synced. Scan again to read it all.
- Fixed: **The New in button clears.** Once you've opened it, it's gone, and it leaves on its own a week after an update.
- Fixed: **How long a scan took.** When a scan ends, the popup now shows it (like "Scanned in 12s") for 5 seconds.

## 0.5.5 — 2026-10-27

- Fixed: **Scans that stop partway.** The popup no longer stays on Scanning: it says the scan stopped, offers Scan Again and keeps your last full scan.
- Improved: **Wishlist items open in the Store.** On the popup's Wishlist tab, an item's name opens it in the Store on openhangar.space.
- Improved: **A cleaner popup.** Your balances sit in one strip with Buy-Back Tokens under it, Fleet News reads as simple rows, and Account Value's change is spelled out in words. Notifications shows in Settings only while you're connected to openhangar.space, and the version number moved to the bottom of Settings.
- Changed: **Scan at the top of the popup.** Scan now sits at the top of every tab, and the button itself shows the scan's progress: the part it's reading and its count, then how long the scan took. If a scan stops, it says Scan Again. The popup also has a quieter look.
- New: **UEC change in the popup.** Next to Account Value's change, the popup now shows how your UEC changed since an earlier scan.
- Changed: **Privacy policy updated.** It now says your scan history keeps your UEC at each scan, in this browser only, sync leaves it out, and the popup shows UEC, REC and how your UEC changed.
- Changed: **Auto Scan Daily is now the Daily Scan Reminder.** At most once a day, when your last scan is over a day old, it shows a notification and clicking it starts a scan, so Open Hangar never reads RSI on its own. If you had Auto Scan Daily on and notifications allowed, the reminder is already on; if not, turn it on in Settings.
- Changed: **Privacy policy updated.** It now describes the Daily Scan Reminder in place of Auto Scan Daily.

## 0.5.4 — 2026-10-24

- Changed: **Store alerts follow Remind Me.** The bell is gone: the Wishlist tab counts your Remind Me items on sale and lists them first, and only those items get the toolbar number and notifications. Paints and sales for ships you own show in Fleet News.
- New: **Scan progress bar.** While a scan runs, the popup shows one bar where Scan sits, naming the part it's reading with a running count, then how long the scan took.
- Changed: **A tidier Settings tab.** Sync, Auto Scan Daily and Notifications sit together in one box, the backup and CSV files are under Export Data next to Log Out of RSI, and Clear Data is at the bottom.
- Changed: **Privacy policy updated.** Store Alerts now says alerts follow Remind Me, and notifications have their own switch in Settings.
- Improved: **Buy-back details.** Scan now also reads the RSI pages of up to 30 buy-backs it hasn't read yet (upgrades have none), so their price, insurance and contents sync to openhangar.space.
- Changed: **Privacy policy updated.** It now says Scan reads up to 30 buy-backs' own pages and Auto Scan Daily doesn't, sync sends their price, insurance and contents, recruits are kept as dates only, and recovery copies go after 30 days.
- Fixed: **Buy-back pages that won't load.** A buy-back page RSI can't serve no longer takes one of a scan's 30 reads, and it's tried again later.
- Fixed: **Switching accounts on Connect.** Open Hangar now tells your openhangar.space accounts apart by their ID, so it asks before switching even when two accounts share a name, and not after you rename one.
- Fixed: **Clear Data clears everything.** It now also removes the buy-back details saved from their RSI pages.
- Changed: **Less about other players.** Your recruits and prospects are kept as dates only, with no handles, names or pictures, in this browser and in sync.
- Improved: **Recovery copies expire.** A copy kept to recover a damaged save is deleted after 30 days, or sooner after a complete scan.
- Changed: **Leaner sync.** Scan history syncs without your Store Credit, which stays in this browser for the popup's Account Value.
- Changed: **A leaner pledge archive.** Pledges that have left your hangar are kept without pictures or giftable and meltable flags.
- Improved: **Ship makers.** Scan now also saves the maker RSI shows under each ship in your hangar, and sync sends it to openhangar.space. After this update the popup marks your last scan as old until you scan again.
- Changed: **Words instead of arrows.** An upgrade's name now reads like "Aurora MR to Mustang Alpha", help paths use slashes, and the popup's chevrons are drawn icons.

## 0.5.3 — 2026-10-23

- Improved: If RSI changes a page, the scan stops and your last scan is kept.
- Improved: **When RSI isn't answering.** Scan now says so instead of showing an error, and nothing from your last scan is lost.
- New: **UEC and REC in the popup.** They get their own cards, and every popup number now fits its box, with short forms like 1.2 M.
- Changed: **Safer connecting.** Connect This Browser on openhangar.space now opens Open Hangar's own sign-in window, and switching to another account asks you first.
- Fixed: **Connect on Firefox for Android.** It works again, with a code you approve on openhangar.space.
- Changed: Store alerts no longer tell you about buy-backs. Paint alerts only come for ships still on their default paint.
- Improved: A scan whose pledge count doesn't fit RSI's page count is treated as cut short, so it can't replace a bigger scan.
- Improved: A hangar or buy-back list saved by an older version shows as out of date, and Auto Scan reads it again on its next run.
- Improved: **Shortcut on a Mac.** The popup shows its shortcut the Mac way, ⌥⇧O.

## 0.5.2 — 2026-10-20

- Fixed: **Shortcut on Firefox.** The popup's shortcut is now Alt+Shift+O, because on Firefox Alt+Shift+H opened Firefox's Help menu. Settings shows the shortcut your browser uses.
- Fixed: **Scan while signed out.** When RSI has signed you out, Scan now tells you to log in to RSI instead of stopping with no message.
- Fixed: **Scan again right away.** After a scan that read nothing, Scan works again at once, so you don't wait a minute after logging in to RSI.
- Changed: **Privacy policy updated.** The cookies line now says RSI's session cookie only hints whether you're signed in.

## 0.5.1 — 2026-10-20

- Fixed: **Scan while signed in.** The popup no longer asks you to log in to RSI when you already are.
- Fixed: **Long buy-back lists.** A scan no longer counts the same buy-back more than once.
- Fixed: **Settings tab.** Look, Currency and Shortcut line up again, Currency shows the full code, and the data buttons fit inside the popup.
- Fixed: The Update Ready notice and our scan notices in the popup look right again.
- Fixed: **Connecting again.** Connecting an extension that's already connected no longer leaves an old row in Connected Extensions on your account.
- Changed: The popup always opens on the Hangar tab.
- Changed: Arrow symbols are gone from the popup's links and buttons.

## 0.5.0 — 2026-10-18

- Fixed: **Notifications on Firefox.** Turning them on now closes the popup so Firefox's question can show.
- Improved: The popup shows when an update is ready, with Reload to Update, and any notice from us about scans.
- Changed: After you connect, you land on My Hangar on the website.
- Improved: The alerts list stays short: with more than three alerts it scrolls, and each alert takes less room.
- New: **Delete alerts.** An × on each alert, and Clear All. A deleted alert comes back only if something new matches it.
- Improved: Settings is shorter: Look, Currency and Shortcut sit on one row.
- New: **Remind Me on each Wishlist item.** With it off, store alerts skip that item. The website's Wishlist has the same switch.
- Changed: **Privacy policy updated.** The Wishlist lines cover the Remind Me switch and no longer mention target prices.
- Fixed: **Upgraded insurance.** A pledge whose insurance was upgraded now shows the upgraded term, not the one it came with.

## 0.4.1 — 2026-10-14

- Changed: **No Target Price on Wishlist items.** Ships go on sale or they don't, so there's no price to wait for.

## 0.4.0 — 2026-10-14

- New: **A new toolbar popup.** Three tabs, Hangar, Wishlist and Settings, plus an alerts bell whose number matches the toolbar badge. The Hangar tab shows your RSI portrait and handle, Account Value and how it changed since an earlier scan, Store Credit, Buy-Back Tokens with the next refill, up to three Fleet News notes, and Scan.
- New: **Scans run out of sight.** No more scan tab: the scan runs in a hidden page, and closing the popup doesn't stop it. If your browser closes mid-scan, the parts that finished are saved and the popup shows Scan stopped, even after a restart.
- New: **Auto Scan Daily (optional).** While you're connected to openhangar.space, Open Hangar can check your hangar once a day. It looks at the newest pages first, runs a full scan only when something is new or once a week, saves part by part, and skips days when you're signed out or signed in to a different RSI account. Off until you turn it on.
- New: **Your Wishlist in the popup.** While you're connected, search to add a ship, paint or upgrade, set a Target Price, or remove an item. Search runs on your device. With store alerts off, it covers ships only.
- New: **Pick your currency.** Amounts show in US dollars until you pick another currency in Settings. After that they use the day's rate, and hovering an amount shows it in dollars.
- New: **Light mode and a shortcut.** Look follows your browser, or pick Dark or Light. Alt+Shift+H opens the popup.
- Changed: **Settings live in the popup now:** Sync Now, Disconnect, Store Alerts, Notifications, Look, Currency, Shortcut, JSON Backup, Pledges CSV, Buy-Backs CSV, Saved Accounts, Log Out of RSI, Clear Data, Help, Report a Scan Problem and Privacy.
- Changed: **The Open Hangar page is smaller.** It opens only to ask you something, or to run a scan that can't run hidden. Its pledge and buy-back lists are gone. Open My Hangar shows your whole hangar: My Hangar on openhangar.space when you're connected, or hangar.openhangar.space when you're not.
- Changed: **Signed out of RSI?** The popup shows Log In to RSI, and Scan waits until you're signed in again.
- Changed: **Privacy policy updated** for the popup, hidden scans, Auto Scan Daily and Wishlist editing: openhangar.space/privacy.html
- Improved: A badge on the toolbar button when there's new Fleet News, a dot on the version tag once per new version, how long each scan took ("Scanned in 38s"), and the popup reopens on your last tab (Hangar when there's news).
- Fixed: **Connecting mid-scan.** Connecting to openhangar.space during a scan no longer sends half a hangar.
- Changed: Open Hangar no longer keeps the referral code of the player who recruited you. Updating clears any saved copy. It was never synced or exported.

## 0.3.1 — 2026-10-14

- Improved: Scans ask RSI for each page at its own address instead of being redirected
  first, so a scan sends half as many page requests and lands sooner.

## 0.3.0 — 2026-10-13

- Changed: **The extension is now a lighter connector, and your full hangar opens on
  openhangar.space.** The toolbar button opens a popup with your Account Value, your
  last scan, Scan and store alerts. One extension page stays, with your pledges and
  buy-backs (search, totals and CSV), your backup and your settings. The dashboard's
  other pages are gone from the extension: press Open My Hangar to see your whole hangar
  at hangar.openhangar.space, with no account. Your scans still stay in this browser.
- Changed: **Open beta until launch day, November 10.** Everything in this update is
  yours now. Syncing your hangar to openhangar.space opens to everyone on November 10.
  Until then it's for beta testers.
- Fixed: Add to RSI Cart no longer blames a buy-back in your cart when RSI turned the
  upgrade down for another reason. It shows RSI's own message instead.

## 0.2.19 — 2026-10-06

- Fixed: **the next buy-back token is back on the radar.** Open Hangar only knew RSI's 2026
  token dates, so after October 5 the "Next Buy-Back Token" line went dark. It now works
  out the next ones from RSI's pattern (the first Monday of each quarter) until RSI posts
  next year's schedule.
- Changed: **the next token shows up in its last 30 days.** A three-month countdown was
  just noise, so the date now appears on Home and Buy-Backs once a token is a month or
  less away. Your token count is always there, and hovering it names the next date.

## 0.2.18 — 2026-10-04

- Fixed: **Reclaim on an upgrade buy-back lands on the right pad.** It used to drop you on
  the front page of RSI's pledge store. Now it opens just that upgrade in your buy-back
  list on RSI, where its Buy Back button brings up the upgrade window for exactly that
  pledge.

## 0.2.17 — 2026-10-04

- New: **an Open Beta note.** Open Hangar is still spooling up for its official release
  on November 10, so a small card on the dashboard says so, with a link to our Discord for
  questions, ideas and bug reports. Close it once and it stays closed; it leaves on its own
  after release day.
- Improved: **rescans of a quiet hangar are way faster.** If nothing changed since your
  last scan, Open Hangar spots it from your first and last hangar pages and skips the
  rest: "hangar's exactly how you left it." Anything new, melted, gifted or upgraded
  away means a full scan as usual, and it reads everything again at least once a day.
- New: **full-size pictures.** Click the picture in any detail window (Inventory,
  Buy-Backs or a ship) to see it big, at the original size RSI keeps on file. The big
  copy only loads when you open it, one at a time, so lists stay quick. Escape or the
  close button takes you back.
- Improved: **retired ships say so on Buy-Backs.** RSI retired the Aurora Mk I and the
  Hornet Mk I, so their ships, the packs that hold them and upgrades to or from them can't
  be reclaimed any more. Those now show a Retired label instead of a Reclaim link. Their
  paints keep the link, since RSI still lets you buy those back. (Also: the About page
  now thanks the Star Citizen Wiki for its ship data.)

## 0.2.16 — 2026-10-02

- Improved: **scans ride out a busy RSI.** When RSI asks us to slow down, Open Hangar now
  waits a little longer each time (up to five tries) instead of giving up, and tells you
  it's retrying while it waits.
- Improved: **items RSI forgets to label still land in the right group.** When RSI leaves
  an item's type off, Open Hangar reads it from the name where that's safe (insurance,
  paints, and the ship a Standalone Ships pledge is named after).
- New: **an early warning when RSI changes its hangar page.** Each scan notes how much it
  could read, and the error report says so if dates, values, item lists or pictures
  suddenly stop coming through, so we can patch it before your data looks wrong.

## 0.2.15 — 2026-10-01

- New: **Open Hangar talks like a fellow Citizen now.** Scans, errors, empty pages and
  tips got a Star Citizen voice ("That one felt like a 30k"), with a plain hint wherever a
  joke could hide what something does. Warnings, numbers and prices stay straight.
- New: **rotating lines** while you scan, load, sign out or catch up on alerts, picked at
  random and never the same one twice in a row.
- Improved: **every link and button label is in Title Case**, so they're easier to spot.
- Improved: How to Use is now the **Pilot's Handbook**, with clearer section names.
- New: **Known Issues** in the menu shows the bugs we're already working on, straight
  from GitHub, so you can see if yours is on the list before reporting it. It's only
  fetched when you open the page; nothing about you is sent.
- New: **Report a Scan Problem.** When a scan fails, one click opens a GitHub issue with
  the error report already filled in. You read it and submit it yourself; nothing is sent
  in the background, and it has nothing about your account.
- Improved: **keyboard and screen reader support.** Tab and Enter now reach every card,
  filter chip, menu and pop-up, with a clear blue ring on whatever has focus, Escape closes
  menus and pop-ups, icon buttons and search boxes have names, and dim text is easier to read.
- Fixed: one unreadable buy-back page no longer stops the rest of your buy-backs from
  loading. That page is skipped and the others come through.

## 0.2.14 — 2026-10-01

- Fixed: **you can type in Home's Global Hangar Search again.** In 0.2.13 the box cleared
  itself after the first letter, so nothing could be typed (the top bar's search was fine).
- New: **Support Open Hangar** if you like: Ko-fi and Patreon links in the footer and on the
  Developers page. Open Hangar stays free, with no ads and nothing locked.
- Improved: **currency conversion no longer depends on an outside rates service.** The
  day's European Central Bank rates now come from openhangar.space itself, so they load
  fast and keep working when a third-party site is slow or down. One less outside site in
  the privacy policy.

## 0.2.13 — 2026-10-01

- Improved: **When RSI changes their site and breaks a scan**, Open Hangar can now pause just
  that scan and show a short notice ("a fix is coming") instead of an error, without waiting
  for a store update. Your saved data is never touched. It reads a small status file from
  openhangar.space every few hours; nothing is sent.
- Fixed: **Damaged saved data no longer stops Open Hangar from opening.** Anything that can't
  be read is set aside (never deleted), everything readable is kept, and a notice offers to
  restore your last backup file.
- Improved: saving a scan is lighter on big accounts: your scan history is stored on its own,
  so it isn't rewritten every time buy-backs or referrals are saved.
- Improved: **Global Hangar Search finds ships inside buy-back packs** (once a pack's details
  are loaded), shown as "400i, inside Origin Complete Pack". Packs whose contents haven't been
  read yet get a quiet "Get Details" link right in the results.
- Improved: search results are sorted by type, packs first, then packages, ships, paints and
  CCUs, so the big stuff is never cut off by add-ons.
- Improved: both global searches start empty: clicking away, pressing Esc, opening a result or
  changing page clears them.
- Improved: **shorter buy-back titles**: no more "Standalone Ship -", "Package -",
  "Subscriber Store -", Warbond or Standard Edition in the list. The full RSI name is still in
  the tooltip, the details window and your exports, and the Warbond filter is gone from
  Buy-Backs (it still lives in Inventory).
- Improved: **big accounts are much snappier.** Buy-Backs with a thousand items opens
  straight away, search waits for you to stop typing, and ship pictures only load for what's
  on screen.
- Improved: the first scan shows a proper progress bar on the welcome card, and later scans
  show what they're on in the Scan button's tooltip and menu.
- Improved: **sharper ship pictures on high-res screens**, loaded once at the right size with no
  blurry-then-sharp jump, and the first screen of Inventory and Buy-Backs is ready right after
  a scan.
- Improved: Streamer Mode shows as a small purple dot on your portrait instead of a pill in
  the top bar.
- Improved: the referral share image now says which month was your best ("best month · Mar
  2024").
- Improved: loading buy-back details is gentler on RSI: if RSI asks to slow down, it stops
  right away, keeps everything it already read and tells you when to try again.
- Improved: Home loads even when one of the outside sites (the wiki, exchange rates, RSI's
  news) is down: requests give up after a few seconds and a site that's down is left alone
  for a bit.
- Fixed: **packs and packages are their own types**, each with its own section. A package
  includes the game (Star Citizen or Squadron 42), like the Mustang Alpha Starter Pack; a pack
  is a bundle without it, like the Nine Tails Shogun Pack, or anything with "Pack" in its name.
  Neither shows up under Standalone Ships any more.
- Fixed: scrolling over the gaps in the search results scrolled the page behind them.
- Fixed: the scan progress line pushed the Citizen Card around.
- Fixed: with Streamer Mode on, the top bar wrapped onto two rows.
- Fixed: a gap opened between the slim top bar and the sticky section titles on Inventory.
- Improved: **Account Value counts everything you own.** Ships at today's store price, CCUs at
  their standard price, everything else (paints, gear, add-ons) at melt value, plus your
  Store Credit, with a line showing what it's made of. Buy-backs, UEC and REC aren't counted.
- Improved: on Home, the Account Value trend pills now sit right beside the big number, so the
  card is tidier and the chart gets the room.
- Fixed: the value chart and "since" amount on Home now match the Account Value number.

## 0.2.12 — 2026-09-30

- New: **A fresh look.** Open Hangar has a new, cleaner design: graphite panels, bigger and
  clearer numbers, and colour only where it means something. More pages get their full
  redesign in the next updates.
- New: **A rebuilt Home page.** Your account value up top, with how much it's grown since your
  first scan (with a small chart of every scan), how it compares to its melt value, and
  counts you can click to jump straight into Inventory with that filter on.
- New: **Game Status** beside your Citizen Card: the LIVE version and when it was released
  ("14 days ago"), what's on the test servers with the PTU wave, a link to the latest patch
  notes, the event running right now (only while it's actually on), any referral bonus
  event, and when your next buy-back token arrives.
- New: **Hangar Alerts** in the top bar's bell: a wishlist ship on sale, a ship you own
  turning flight ready, buy-backs that match your wishlist, and your enlistment anniversary.
  Ignore any you don't care about.
- New: **Latest Acquisitions** (your five newest pledges) and **Hangar Spotlight** (a ship from
  your fleet with its picture and specs; flip to another).
- New: **Latest From RSI** now includes patch notes, each tagged NEWS or PATCH.
- Improved: the top menu stays pinned while you scroll, on every page except Home.
- New: **Global Hangar Search** has its own full-width line under the Citizen Card (press /
  on any page, as before) and much richer results: a plain yes or no first, then each match
  with its picture, what it's inside, its key facts and its price.
- New: **Scan lives in the top menu** on every page. It says **Scan All**, or **Scan Custom**
  when you untick something in its ▾ menu (which now explains each option), and it
  remembers your choice.
- New: **A welcome screen** on Home until your first scan, with one big **Scan All Now**.
- Improved: the "buy-backs match your wishlist" alert opens Buy-Backs showing just those
  buy-backs, with a Show all button.
- New: **The gear menu** (top right) holds your currency, **Streamer Mode**, the rescan
  reminder, **Log Out of RSI** (for switching accounts; your saved data stays), Clear Data, and
  the Updates and Developers pages.
- New: **Streamer Mode** hides money amounts across Open Hangar, for streams and screenshots.
  A "Streamer" tag shows in the top bar while it's on.
- New: **A new top bar.** The Open Hangar logo, counts beside Inventory and Buy-Backs, a
  search box on every page (press /), an **alerts bell** with your Hangar Alerts, and your
  RSI portrait opens your menu. Scan shows its progress right on the button, and the bar
  slims down while you scroll a long page. When an update is waiting, a dot on your portrait
  and a Reload button in the menu say so.
- New: **Inventory and Buy-Backs got the Home look:** a summary strip on top that follows
  your filters, one tidy toolbar with **Export** (what's showing as CSV, a share image, or a
  full backup), and **Hide small stuff** to tuck paints, add-ons and coupons away.
- New: **Saved views** on Inventory: save a set of filters and get back to it in one click.
- New: **Melt planner.** Pick pledges with Select and see what their melt value buys from your
  wishlist, in the store or from your buy-backs.
- New: prices show **"$X under store"** in green when today's store price is higher, and
  Buy-Backs has a **Below store price** filter and an optional **Stack identical** view.
- New: Account Value says when you last scanned ("Updated today, 9:45 AM"), and turns amber
  with a Rescan link after a week.
- Fixed: Stats' tabs ran off the side of a phone screen; they wrap now.
- Fixed: "vs what you paid" is now **"vs melt value"** (Home and Stats). RSI only knows a
  pledge's original price, not what you paid for a gifted or grey-market pledge.
- New: **A new Citizen Card**, laid out like an ID: your portrait down the side in full
  resolution, your org's logo beside its name (and faintly behind the card), "Est. Aug 2017 ·
  9 years", your Subscriber and Chairman's Club badges, and your wallet with the date of your
  next buy-back token. Your name and portrait open your RSI page; the org opens its page. Not
  in an org? Nothing shows.
- Fixed: pictures, prices and specs for the original Auroras ("Aurora MR", "Aurora LN"…), which
  RSI renamed "Aurora Mk I". Packages and starter packs ("Aurora MR Starter Pack") now show
  the ship inside instead of a blank box.
- Changed: **Open Hangar's code is now source available** (PolyForm Strict License). It stays public on GitHub so anyone can read and audit it, but it can't be copied into other versions. Earlier releases stay MIT.
- Improved: the "Open Hangar vX · What's new · Star Citizen X" line moved to the page footer.
- Improved: Org Fleet: a role nobody has lists **every** ship that fills it (cheapest first, scrolling), not
  just the 10 cheapest, so big ships like the Orion show up.

- Improved: **Org Fleet roles cover every ship.** A ship now keeps every role the wiki lists, not just the
  first (the Kraken is Multi-Role and Light Carrier, so it counts as a carrier). New role groups
  for fighters, gunships, ground combat, minelaying, recovery, reporting, multi-role, starter and
  racing, named after the wiki's own roles. A test fails if any ship's role isn't placed.
- Improved: Biggest Ships sizes are capitalized (Capital, Large, …).
- Improved: Buy-back cards line up: badge and date on one row, price and Reclaim on the next, whatever the
  date's length.
- Fixed: hovering a button no longer turns it solid blue (that hid the text of outlined buttons and tabs);
  it just brightens.
- Improved: **Updates page splits each release into New (green), Improved (blue) and Fixed (red)**, so new features
  are easy to spot.
- Improved: **Check for Updates works on Firefox.** It asks Firefox Add-ons for the latest
  version and tells you whether you're on it, instead of pointing you to about:addons.
- Improved: the currency picker in the top right is no longer bold.
- Fixed: Home showed a big empty box when your wishlist was empty.
- Improved: every word is capitalized in Org Fleet roles, sizes and charts ("Science / Data", "Capital",
  "Light Fighter"), ship statuses ("Flight Ready", "In Concept") and table headers.
- Fixed: ship sizes that showed as "undefined". Ground vehicles (Storm, Nova, Spartan, Ursa…)
  now say Vehicle, and special editions (Wikelo Specials, PYAM Exec…) use their base ship's size.

## 0.2.11 — 2026-09-29

- Improved: **Org Fleet:** your own entry now follows your latest scan (Add my fleet used to be a one-off
  copy, so ships bought later never showed). A role covered only by in-concept ships (a Pioneer for
  Construction) shows in amber as covered, not missing, and the role panel lists each ship's status.
  Comparison charts draw the other side in bright white instead of grey, so it stands apart from
  your blue.
- Improved: **One color, one meaning, on every page.** Item types (ship, pack, package, CCU, paint,
  add-on, coupon) each have their own color and nothing else uses it, now also in filter chips,
  the buy-back window and Stats charts. Green is good news, amber is worth a look, red is a
  problem, blue is clickable. Balances are plain white. A **Color Key** is under How to Use on
  Home, and image exports use the same palette.
- New: **Home redesign bits:** a big **Global Hangar Search** sits centered under the Citizen Card
  (press / on any page to jump to it). It searches only what's yours (pledges, buy-backs, earned
  rewards), not the store. The currency picker moved to the top right of every page.
- Improved: Citizen Card tidied: balances are compact tiles with short amounts (¤ 1.2M, ¤ 90K; hover for the
  exact figure), referral and flair share one row, and the rescan reminder and Clear Data live
  under a settings button.
- Improved: After a scan, Home no longer repeats the counts above the Scan button (only problems show).
- Improved: Works on narrow windows, tablets and phones: the card stacks, the balances go 2×2, and the nav
  becomes one swipeable row.
- Fixed: pack buy-backs showed a store price far below the buy-back price because only one
  ship was priced. Now every ship in the pack counts (after Load details); before that, no
  store price is shown rather than a wrong one.
- Improved: Stats → History now charts **account value** (your ships at today's store prices) instead
  of melt value.
- Improved: **One color per type, everywhere:** ship green, CCU purple, paint pink, add-on blue, coupon
  orange, pack gold and game package teal, on badges and filter chips across Inventory,
  Buy-Backs and the wishlist. Packs and game packages in Inventory now say PACK / PACKAGE.
- Improved: Big amounts in the Home summary shorten ("CN¥13.7K") so they fit; hover for the full value.
- New: **This Week in Star Citizen** on Home: the newest weekly post with its picture and opening
  paragraph; "Read it on RSI" for the rest.
- Changed: Removed "melt candidates" (the Inventory filter, the Stats section and the item-window line):
  the idea that you could melt a pledge and buy it back for the same credit doesn't hold up.
- Fixed: the Scan ▾ menu was cut off by the Citizen Card; it now opens below the button.
- Improved: **A cleaner Home page.** The column of page links is gone (the top bar has them) and "How
  to Use" is one dropdown. Side by side: **Wishlist: On Sale Now** (your wishlist ships in
  RSI's store right now; hidden when your wishlist is empty) and **This Week in Star Citizen**, the
  same height; long lists scroll inside.
- New: **Scan → Store (wishlist)** re-checks RSI's store for your wishlist ships; untick the rest to
  check only the store.
- Improved: The scan badge by the title stays short ("Scanning…", details on hover), so it no longer
  pushes the search box onto a second line.
- New: Referrals: hover a dot on the reward ladders to see that tier's reward picture.
- Improved: Store searches show how many there are ("Search 221 ships…") and a live count while you
  type ("4 of 221"); the CCU search hides when you only have a few.
- New: **Sort your wishlist.** Name (the default), price high to low or low to high, in stock
  first, or **My order**: grab a ship and drag it; the others slide out of the way as it
  moves, and the order is saved when you let go.
- Improved: Prices no longer carry a "~". Buy-back prices that are still today's store price (until
  Load details reads RSI's exact one) say so when you hover them.
- Improved: Wishlist buy-backs include **packs that contain the ship** (e.g. a 600i inside the Origin
  Complete Pack), listed ships first, then packs, then CCUs, with a Type column. Load details
  on Buy-Backs to check every pack's contents.
- Improved: Wishlist: removing a ship is a small ✕ now, with an **Undo** bar for a few seconds in case of a misclick.
- Improved: **A tidier Store page.** Wishlist, Your CCUs and Ship Prices are now separate panels;
  long lists scroll inside their panel with their own search, and Ship Prices has tabs
  (Flight Ready, In Concept, All). Ships "in production" count as In Concept (neither can be
  flown yet).
- New: **In store now.** For your wishlist and in each ship's window, read from the ship's own
  page on RSI's store: "In stock" (sold on its own, with the price), "Only in a pack"
  (hover for which), or "Not in store".
- New: **Wishlist buy-backs.** Shows ship buy-backs and CCUs to that ship separately; click to
  see every one with its melt date, pledge ID, price and Reclaim link.
- Improved: Your CCUs lists all of them (identical ones stacked), not just ones with known prices.
- Improved: The Buy-Backs table image leaves out the "vs Store" column (it's still on screen).
- Fixed: buy-back pictures looked blurry in the details window; they now load the sharp version.
- New: **Wishlist.** Add ships from their details window; Store → Wishlist shows each one's
  price, whether you already own it, and any copies in your buy-backs you could reclaim
  instead. Upgrade paths link to ccugame.app.
- New: **Spending over time.** Stats → Spending: what you've pledged each year and the running
  total. Private, like everything else.
- New: **Sale heads-up.** A banner on Home while a referral bonus event is running (they come
  with IAE, Invictus, CitizenCon and the other big sales).
- New: **Images download.** Every picture export (Market and Buy-Backs tables, fleet image,
  referral share image) now saves a PNG instead of copying to the clipboard.
- New: **Global hangar search.** A search box at the top (press **/**) finds ships, your pledges
  (including what's inside them), buy-backs and referral rewards in one go.
- New: **Ship details.** Click any ship name (in search, pledge contents, or the Store's price
  list) for its specs, store price, which of your pledges and buy-backs have it, its
  loaners, and links to RSI, the wiki, Erkul and ccugame.
- New: **Loaners.** Stats → Fleet lists the loaner ships your not-yet-flyable ships give you,
  straight from RSI's Loaner Ship Matrix. Only ships you can't fly in the game yet get loaners.
  **Included Vessels** (the snubs and rovers a ship comes with for keeps, like the Carrack's
  Pisces and URSA) are listed separately, and show in each ship's window as "Comes with".
- New: **Check for updates.** A button on the Updates page asks the store for a new version
  right away (Chrome and Edge); Firefox gets directions, since it checks on its own.
- Improved: **Referrals, levelled up.**
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
- Improved: **Land Claims get their own group.** Geotack Planetary Beacons (and Geotack-X) and
  other land claims show under Land Claims, and as "Land Claim" inside pack contents.
- Fixed: the Hangars group and Gear labels from 0.2.10 didn't show up.
- Improved: **Sturdier scans.** A hiccup from RSI or the wikis no longer overwrites good data:
  a referral list that fails keeps your last scan's, a half-downloaded ship list isn't
  saved, and failed picture lookups are retried instead of remembered. Very large
  hangars no longer hit the browser's storage limit (scan history is capped by size),
  and hangars past 2,000 pledges are read in full.
- Fixed: "10 Year" insurance showed up two ways; it's now always "120 Months".
- Fixed: importing a backup kept everything except your buy-back token count.
- Fixed: when RSI's image server drops a picture, it's retried once instead of staying
  blank until you refresh.

## 0.2.10 — 2026-09-29

- New: **Buy-Backs Market tools.** Like the Inventory Market: tick rows to see their total
  and how many tokens they'd use, compare with today's store price (and what you save
  once details are loaded), jot My Price / %, and Export CSV or Copy image.
- Improved: **CCUs show the ship you're upgrading to.** Cards and the details window (Inventory
  and Buy-Backs) use the destination ship's picture instead of RSI's generic upgrade art.
- Improved: **Market images are tables.** In Market view, Copy image and Save PNG make a picture of
  your picked rows as the table (grouped by section, with store price and your title),
  easy to read down; the card picture is still there in the other layouts.
- New: **Market: Store Price column.** Each row shows today's store price next to its melt
  price, so the gap is easy to see (also in the CSV).
- Improved: **Market: pricing ticks the row.** Typing a price or % ticks that item for export.
- Improved: **Hangars get their own group.** Pledges like VFG Industrial Hangar or Self-Land
  Hangar show under Hangars in Inventory and Market.
- Improved: **Gear is labelled.** Pack contents RSI leaves unlabelled (helmet, core, arms, legs,
  backpack…) now show as Gear, and hangars as Hangar.
- Improved: **More currencies.** Home → Currency adds NZD, CHF, SEK, PLN, CZK, BRL, CNY, JPY and KRW
  (yen and won shown without cents).
- New: **Store listing in 11 languages.** The extension's description now shows in your
  browser's language: 简体中文, Français, 한국어, Español, Português, Deutsch, Українська,
  Italiano, Čeština and Русский.
- Improved: **Sharp pictures right away.** Clicking an item shows its picture clearly at once
  (no blurry loading step); a higher-res copy slips in when it's ready.
- Fixed: some items (e.g. StarKitten helmets, Epoch Society shirt, AMD Never Settle
  pack, Puglisi Collection) showed no picture because RSI gave a partial image link.
  Already-scanned items are fixed too, no rescan needed.
- Fixed: some ships (e.g. Vanduul Blade, P-52 Merlin, Nox, Mustang Omega AMD Edition)
  showed a blank card when RSI's image link was broken; they now fall back to the
  ship's art from RSI's ship list. Missing-image lookups retry after a day.
- Fixed: hovering a name in the Buy-Backs table no longer covers it in a blue box.

## 0.2.9 — 2026-09-28

- Improved: **Org Fleet you can explore.** Click a role to open which ships fill it and who
  owns them; click a missing role to see ships that would fill it, cheapest first.
  Click a member to see their fleet next to the rest of the org (role and size
  charts side by side, and roles only they cover). **Compare** any two members:
  totals, charts, and which ships both own or only one does.
- Improved: **Inventory grouped by type.** Gallery, Compact and List now show Standalone
  Ships, Packs, Upgrades, Paints, Add-ons, Coupons and Other as their own sections,
  with the title pinned while you scroll. Your sort applies inside each section.
  Untick **Group by type** for one big grid.
- New: **More Stats.** Three new tabs. **Collection**: your insurance mix, giftable and
  meltable counts, and per manufacturer how many of their ships you own ("Origin:
  9 of 17", hover for which). **Buy-backs**: what it would cost to buy everything
  back, your tokens and the next one, the most valuable buy-backs and the ships
  you've melted most often. **Top lists**: most valuable pledges, biggest savings vs
  store price, oldest pledges and most valuable LTI ships. Click any row to open it.
- New: **What's in a buy-back.** Click a buy-back's name (Market) or card to see what's
  in it, read from its RSI page: every ship in a pack, the insurance, what else it
  includes, and the real buy-back price. **Load details** does the same for every
  buy-back you're looking at, one page at a time, so the Insurance and Price columns
  fill in (prices marked ~ are estimates until then). Each page is read once and
  kept.
- Improved: **Buy-backs, one row each.** The Buy-Backs Market no longer merges same-named
  buy-backs: each is its own pledge with its own insurance and extras, and each
  **Reclaim** opens that exact one (CCUs open their single buy-back entry, where
  RSI's reclaim button is). New **Packs & packages** section and an **Insurance**
  column (read from the name when RSI includes it). Add-ons such as Retaliator
  modules no longer land under Ships.
- New: **Insurance in List view.** Inventory's List layout has an Insurance column (LTI,
  120 Months, 6 Months, …). Insurance reads in full everywhere ("120 Months", not
  "120M"), including the Market and fleet images.
- New: **Your currency.** Pick USD, EUR, GBP, CAD or AUD on the Home card and every
  amount (melt value, store prices, buy-backs, org value, images) shows in it,
  converted from USD at the day's rate, before tax. Rates are public (the ECB's,
  via Frankfurter) and fetched at most once a day. My Price stays as you type it.
- Improved: **Shorter links.** Links to your RSI hangar just say **View**; every buy-back has one
  **Reclaim** link.
- Improved: **Updates page restyled.** Big version number and date, with changes grouped
  under **New & improved** and **Fixed**.
- Fixed: on narrow cards the price ran into the M / G tags; it now drops to its own
  line. The Store page's search box and ccugame.app link are styled again.
- New: **Org Fleet: roles, biggest ships, members.** See which jobs your org can cover
  (mining, salvage, medical, refueling, repair, exploration and more) and which it
  can't, the biggest hulls and who owns them, and each member's ship count, LTI
  count and fleet value.
- New: **View on RSI.** Market rows and the item details window link to the page of
  your RSI hangar that pledge is on and say where ("page 4, #3"), handy for a
  screenshot of its details. Positions come from your last scan, so rescan after
  buying or melting.
- New: **Buy-back tokens and prices.** Your buy-back token count (read from RSI's
  buy-back page when you scan) shows on Home and at the top of Buy-Backs, with the
  date of the next quarterly token. Buy-backs now show each ship's store price
  today (or a CCU's price gap), and you can sort **Price: high to low / low to
  high**.
- Improved: **Market: tick and price as you go.** Every Market row has a checkbox now (and
  each table a tick-all), no Select mode needed; the export count updates as you
  tick, and the image bar appears once something is picked. A new **% of Melt**
  column sits next to **My Price**: type 55 and the price fills in at 55% of melt,
  or type a price and the % works itself out. The CSV includes both.
- New: **Concept ships.** The ship list now includes ships that aren't flyable yet
  (Pioneer, Odyssey, Orion, …) from RSI's ship matrix, so they get a store price
  and count toward hangar value. The Store page's price list is split into
  **Flight ready** and **In concept** tables.
- New: **Updates page.** A new **Updates** page lists every release with its date and
  what changed (also linked from the version on Home and in the footer). When a new
  version has downloaded, a bar at the top says so with a **Reload to update**
  button, and after an update Home points you to what's new.
- Improved: **Store page.** Formerly "Store Data": every ship's store price, role, size and
  status with search, plus what each of your CCUs is worth. For planning upgrade
  chains it points you to ccugame.app, which does that job well.
- New: **Org Fleet.** A new page that combines your org members' ship lists into one
  fleet: every ship, who owns it, LTI count, store value, cargo, crew, and a role and
  size breakdown, with CSV export. Members share their **Export HTF** file (ships
  only); full backups work too, but only the ships are read. HTF files are now named
  with your handle so they're easy to tell apart.
- New: **Rescan reminder.** When your last scan is a week old, the Open Hangar toolbar icon
  shows an amber **!** (hover it to see how old). Scanning clears it; switch it off
  with **Weekly rescan reminder** on the Home card. No new permissions.
- Improved: **Hangar value shows instantly, even offline.** A copy of the ship price list now
  ships inside the extension (refreshed weekly), so Stats and store prices appear
  right away while the live list updates in the background.
- Improved: **Safer rendering.** Everything the dashboard draws now goes through an allowlist
  sanitizer, so even unexpected data from RSI or an imported file can't inject
  scripts. Firefox's add-on checker now reports zero warnings (was 26).
- New: **Alt accounts.** Each RSI account now keeps its own data. Sign in as a different
  account and Open Hangar sets the current one aside and loads that account's last
  scan (or asks you to scan). Switch back and everything returns. Developers has a
  **Saved accounts** list with a Remove button. Clear Data now only clears the
  account that's signed in.

## 0.2.8 — 2026-09-28

- Improved: **New Home card background.** A subtle hex-grid texture of our own replaces the
  RSI image, so the Home page no longer loads anything from RSI's media servers.
- New: **How-to on the Home page.** A "How to use Open Hangar" section with Getting
  started open by default, and quick guides for browsing, hangar value, selling,
  backups and getting help.
- Improved: **Shorter install warning.** Chrome now only says the extension can access
  robertsspaceindustries.com. The ship-data site it also uses is public and needs no
  special permission, so we dropped it.
- New: **Error report you can copy and paste.** Open Hangar now keeps a small log of
  errors, failed or partial scans and RSI retries (last 100). When something goes
  wrong, the error message has a **Copy error report** link, and Developers has the
  same button plus a preview of exactly what's in it. It includes your version,
  browser, item counts and recent errors, never your handle, referral code or item
  names. Paste it in #bug-reports on Discord or a GitHub issue (the bug form asks
  for it).
- New: **Suggest a feature** link in the dashboard footer, the Developers page and the
  website. It goes to the new GitHub Discussions → Ideas board, where ideas can be
  upvoted (or tell us on Discord).
- Improved: **Tidier cards.** Kind badges (SHIP / PAINT / ADDON…) are a fixed width so the
  M / G tags line up row to row; card names drop RSI's "Standalone Ships - /
  Paints - / Gear - " prefix (the badge already says it; hover for the full name);
  and the items line only lists what the name doesn't already say, so a paint
  no longer repeats its own name, and ships show just their insurance and extras.
- New: **Back up your history.** The JSON export (Developers → Export JSON, or the new
  **Download backup** button on Stats → History) now includes your scan history,
  and importing a backup **merges** history instead of wiping it. History keeps the
  last **100** changes (was 30). The History tab shows when you last backed up.
- Fixed: in Buy-Backs' List view, rows without an items line were shifted a column,
  stretching the kind badge across the row and squashing the date.
- Improved: **Stats is split into tabs** (Overview, Value, Fleet and History) and remembers
  the last one you opened. Home's "history" link jumps straight to History.
- New: **Fleet image: pick what goes on it.** Click **Select** in Inventory, pick items
  (cards, or checkboxes in Market view), give it a title and choose the price shown
  (melt value, your Market price, store price or none), then **Copy image** or
  **Save PNG**. You get a clean picture card for each item, with ship art,
  contents, insurance and giftable, ready for a sale post or a fleet share. The
  Market CSV and image exports also use your selection when there is one.
- New: **Melt candidates.** Stats lists pledges you could melt and buy back for the same
  store credit: meltable, no LTI, nothing but ships inside, and paid at least
  today's store price. The same list is an Inventory filter too.
- New: **CCU value.** Each CCU is priced at its standard value (the gap between its two
  ships), so warbond CCUs show what they saved you. CCUs also count in **Below
  store price** and appear in Stats' best deals.
- New: **Fleet stats.** Stats shows total cargo (SCU), crew seats, how many ships are
  flight ready, and your fleet by role and size.
- New: **History.** Every full scan that finds changes keeps a small snapshot in your
  browser. Home says what changed since last time (new, gone, upgraded, change
  in melt value), and Stats shows melt value over time with a log you can open
  for each scan.
- New: **Hangar value.** Stats has a new **Hangar value** section: what the ships in
  your hangar sell for at today's store prices, how that compares with what you
  paid, your best deals, and which ships have no public price (concept/limited).
  Prices come from star-citizen.wiki's vehicle list, which is downloaded once and
  cached for 30 days (about 6 requests, nothing per ship). Items show their store
  price in the details popup, Inventory can sort by **Store price**, and Home shows
  the total. Ships only: paints, gear, game access and CCUs aren't priced.
- New: **Below store price filter.** Flags ship pledges you paid less for than today's
  store price, which catches warbonds and sales even when the pledge name doesn't
  say "Warbond".
- New: **Exclude filters.** Click a trait filter once to include, again to exclude
  (red), a third time to clear, e.g. **Not giftable**, **Not meltable**, **No LTI**.
- Improved: "Total value" / "fleet value" are now labelled **melt value**, to tell them apart
  from store value.
- Fixed: the ship-art lookup only read the first 250 of ~300 wiki vehicles, so some
  newer ships never got a picture.
- New: **Hangar Transfer Format export.** New "Export HTF" button on the Developers page
  writes your fleet in the community format FleetYards and other tools import, one
  entry per ship, with ship codes, manufacturer, pledge name/date/cost, LTI and
  warbond. Special editions export as their base ship with the edition kept as the
  ship's name (e.g. a Gladius named "Gladius Dunlevy"), and ships newer than the
  bundled code list are identified from RSI's live ship matrix.
- New: **More Inventory filters.** Alongside Ships / CCUs / Paints / Add-ons, a second
  row of traits you can combine: **Game packages**, **Packs** (ship + paints + gear bundles), **LTI**,
  **Giftable**, **Warbond** and **Free / rewards**, e.g. Ships + LTI + Giftable.
  They sit on their own row under the main filters, and Buy-Backs gets the ones
  that apply there (Game packages, Packs, LTI, Warbond). A **Clear** button resets
  everything.
- New: **Meltable + giftable at a glance.** Each pledge now records whether RSI lets you
  melt it (its Exchange action) as well as gift it. Every card shows **M** and **G**
  tags (green for yes, red for no), and both show in the item details,
  **Meltable** joins the filters, and the Market view uses RSI's own answer instead
  of guessing from price.
- New: **Pledge dates.** Each pledge's purchase date is now read from your hangar, shown in
  the item details, and sortable in Inventory ("Pledged: newest / oldest first").
- Improved: **Sharper, faster ship images.** The blurry hover popup on inventory and buy-back
  cards is gone. Resting on a card now quietly loads a sharp 1200px image, so the
  detail view opens crisp instantly (or fades from blurry to sharp in about a
  second). Fixed PNG ship art never loading its full-size version, and switched from
  4K downloads to a right-sized image.
- Improved: **Sturdier scans.** Temporary RSI errors and rate limits are retried automatically
  with a polite backoff. If RSI keeps failing mid-scan, you keep what was gathered,
  and a partial scan never replaces a bigger earlier one.

## 0.2.7 — 2026-09-25

First store release (Chrome Web Store, Firefox Add-ons, Microsoft Edge Add-ons).

- New: Store-ready builds for Chrome/Edge and Firefox.
- Improved: Security hardening before review: stricter escaping of imported/third-party data,
  buy-back links restricted to robertsspaceindustries.com, and a strict content
  security policy.
- New: Insurance term (LTI, 120M, …), giftable status, and paint detection on pledges.
- New: New website: [openhangar.space](https://openhangar.space).

## 0.2.0 – 0.2.6 — June 2026

- **0.2.6:** pre-launch hardening and documentation.
- **0.2.5:** signed-out view shows your cached scan; buy-back image fixes.
- **0.2.4:** melted-CCU buy-backs show the right ship.
- **0.2.3:** list-view alignment, buy-backs sorted newest first.
- **0.2.2:** referral polish and the full event list.
- **0.2.1:** privacy policy and store launch kit.
- **0.2.0:** dedicated Referrals page with stats, charts, reward tiers and events.
