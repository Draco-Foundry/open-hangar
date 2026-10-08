# Open Hangar Roadmap

Our flight plan: where Open Hangar is going, the steps to get there, and everything shipped so
far.

_Last reviewed: Oct 8, 2026. Dates are UTC._ Live progress: the pinned
[Road to Launch Tracker](https://github.com/Draco-Foundry/open-hangar/issues/468) and
[All Milestones](https://github.com/Draco-Foundry/open-hangar/milestones?direction=asc&sort=due_date&state=open).

Jump to: [The Plan](#the-plan-at-a-glance) · [What Launches](#what-launches-on-november-10) ·
[After Launch](#after-launch) · [Not Planned](#not-planned-and-why) · [Shipped](#shipped)

## Where We're Headed

- **One Fleet Manager, Two Parts.** The extension reads your own RSI account in your browser.
  The website, openhangar.space, turns it into a fleet manager you can open on any device: My
  Hangar, store tools that know what you own, a page for every ship, and later your org and
  the wider community.
- **New Features Land on the Website.** From Nov 10 (extension 0.3.0), the extension focuses
  on reading your account well, with reading improvements and fixes. Everything new is built
  on openhangar.space.
- **Your Data, Your Call.** Open Hangar is free today, with no subscriptions, no premium tier
  and no paid features, and your data is never sold. From Nov 10 you can choose to sync:
  connect a free account and the extension syncs after every scan, or skip it and everything
  stays in your browser. Disconnect any time.
- **Source Available.** The extension's code is here on GitHub under the PolyForm Strict
  license, so anyone can read and audit it.

## Where We Are Today

- **Extension 0.2.19** (Oct 5, 2026) is live on Chrome, Edge and Firefox. It has no sync:
  everything stays in your browser.
  ([Release Notes](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.19))
- **[openhangar.space](https://openhangar.space/)** is live with a Star Citizen news front
  page, the [Open Hangar Store](https://openhangar.space/store) and accounts. Sign-ups are
  invite-only until launch, and sync is open to beta testers.
- **0.3.0** is built and in testing: the rebuilt extension with optional sync. It launches on
  Nov 10.

## The Plan at a Glance

**Shipped** means you can use it now. **Built** means it's done and arrives Nov 10. Each bar
fills as its tasks are done:

[![Wave 1](https://img.shields.io/github/milestones/progress-percent/Draco-Foundry/open-hangar/6?label=Wave%201%20by%20Oct%2016&style=flat)](https://github.com/Draco-Foundry/open-hangar/milestone/6)
[![Wave 2](https://img.shields.io/github/milestones/progress-percent/Draco-Foundry/open-hangar/7?label=Wave%202%20by%20Oct%2025&style=flat)](https://github.com/Draco-Foundry/open-hangar/milestone/7)
[![Beta](https://img.shields.io/github/milestones/progress-percent/Draco-Foundry/open-hangar/8?label=Beta%20by%20Oct%2027&style=flat)](https://github.com/Draco-Foundry/open-hangar/milestone/8)
[![Wave 3](https://img.shields.io/github/milestones/progress-percent/Draco-Foundry/open-hangar/9?label=Wave%203%20by%20Nov%203&style=flat)](https://github.com/Draco-Foundry/open-hangar/milestone/9)
[![Launch](https://img.shields.io/github/milestones/progress-percent/Draco-Foundry/open-hangar/4?label=Launch%20Nov%2010&style=flat)](https://github.com/Draco-Foundry/open-hangar/milestone/4)

- [x] **Jun 1, 2026:** Shipped. First code on GitHub.
- [x] **Sep 28 to 30, 2026:** Shipped. Open Hangar is live on the Chrome, Edge and Firefox
      stores.
- [x] **Oct 1, 2026:** Shipped. The [Ready for Players](https://github.com/Draco-Foundry/open-hangar/milestone/1) and
      [Foundation](https://github.com/Draco-Foundry/open-hangar/milestone/2) milestones are done.
- [x] **Oct 2 to 7, 2026:** Shipped. openhangar.space becomes a Star Citizen news hub and opens
      the Open Hangar Store.
- [x] **Oct 6, 2026:** Built. The [0.3.0 Redesign](https://github.com/Draco-Foundry/open-hangar/milestone/3) rebuilds
      every extension page in one clean look. Arrives Nov 10.
- [ ] **Oct 16, 2026:** [Wave 1: Core Hangar Manager](https://github.com/Draco-Foundry/open-hangar/milestone/6)
      built.
- [ ] **Oct 16 to 19, 2026:** bug-fix days, with no new features. [#507](https://github.com/Draco-Foundry/open-hangar/issues/507)
- [ ] **Oct 20 to 27, 2026:** a small beta with 5 to 10 testers from our Discord.
      [#508](https://github.com/Draco-Foundry/open-hangar/issues/508)
- [ ] **Oct 25, 2026:** [Wave 2: Your Hangar Meets the Store](https://github.com/Draco-Foundry/open-hangar/milestone/7)
      built and in testing.
- [ ] **Oct 27, 2026:** last extension changes in, then a final check before the stores.
      [#509](https://github.com/Draco-Foundry/open-hangar/issues/509)
- [ ] **Oct 28, 2026:** 0.3.0 goes to the Chrome, Edge and Firefox stores for review.
      [#512](https://github.com/Draco-Foundry/open-hangar/issues/512)
- [ ] **Nov 3, 2026:** [Wave 3: Finishing Touches](https://github.com/Draco-Foundry/open-hangar/milestone/9)
      built.
- [ ] **Nov 10, 2026: [Launch](https://github.com/Draco-Foundry/open-hangar/milestone/4).** Extension
      0.3.0 and the website launch together, and sign-ups open to everyone.
      [#513](https://github.com/Draco-Foundry/open-hangar/issues/513)
- [ ] **Then:** four weeks of bug fixes and keeping ship and store data accurate.
      ([After Launch: Fixes and Upkeep](https://github.com/Draco-Foundry/open-hangar/milestone/5))
- [ ] **December 2026 (Planned):** [Wave 4: Community](https://github.com/Draco-Foundry/open-hangar/milestone/10).
- [ ] **[Early 2027](https://github.com/Draco-Foundry/open-hangar/milestone/11) and [Later in 2027](https://github.com/Draco-Foundry/open-hangar/milestone/12):**
      planned, not promised.

A small beta runs Oct 20 to 27 with testers from the
[Draco Foundry Discord](https://discord.gg/FF8Wm5HdnV), and spots are limited.
[Beta Details](https://openhangar.space/beta)

## What Launches on November 10

Waves 1 to 3 are planned for launch day. A wave's date is when it's built and ready for
testing, not when you get it, and anything that isn't ready and tested in time stays switched
off until it is. The Oct 27 cut-off is for the extension, which needs store review. Website
features can keep landing until launch.

### Wave 1: Core Hangar Manager (Built by Oct 16)

The heart of the website fleet manager.
[Wave 1 Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/6)

- **My Hangar: Tabs and Account Switcher:** the frame My Hangar lives in, with a tab for each
  part of your hangar, helpful pages when a tab is empty, and a switcher for your RSI
  accounts. [#469](https://github.com/Draco-Foundry/open-hangar/issues/469)
- **Site Navigation:** one clear menu across openhangar.space, on phone and desktop.
  [#470](https://github.com/Draco-Foundry/open-hangar/issues/470)
- **Ship Explorer:** a page for every ship, with its specs, store prices and news. Built,
  switched off until launch. [#471](https://github.com/Draco-Foundry/open-hangar/issues/471)
  Reading the specs straight from RSI is next. [#460](https://github.com/Draco-Foundry/open-hangar/issues/460)
- **Hangar Overview:** your whole hangar at a glance, the first tab of My Hangar.
  [#472](https://github.com/Draco-Foundry/open-hangar/issues/472)
- **Fleet Tab:** your ships as a fleet, and which roles it covers. [#473](https://github.com/Draco-Foundry/open-hangar/issues/473)
- **Pledges Tab:** every pledge, with an Items view of what's inside and a trade list you can
  copy. [#474](https://github.com/Draco-Foundry/open-hangar/issues/474)
- **Buy-Backs Tab:** your buy-backs on any device. [#475](https://github.com/Draco-Foundry/open-hangar/issues/475)
- **Store Badges:** store items you own say In Your Hangar (shipped, for pilots with a synced
  hangar), and items you could reclaim will say In Your Buy-Backs.
  [#476](https://github.com/Draco-Foundry/open-hangar/issues/476) [#477](https://github.com/Draco-Foundry/open-hangar/issues/477)
- **My Fleets:** build your own named fleets from the ships you own. [#478](https://github.com/Draco-Foundry/open-hangar/issues/478)
- **What Is Open Hangar:** a short page on what Open Hangar is and how the extension and the
  website fit together. [#479](https://github.com/Draco-Foundry/open-hangar/issues/479)
- **Help and FAQ:** answers to common questions, and help when a scan or sync goes wrong.
  [#480](https://github.com/Draco-Foundry/open-hangar/issues/480)
- **Settings and Badges:** your website settings and your badges in one place.
  [#481](https://github.com/Draco-Foundry/open-hangar/issues/481)
- **Status Page:** whether the website, sync and store data are working right now.
  [#482](https://github.com/Draco-Foundry/open-hangar/issues/482)
- **Store Freshness:** the store shows when its prices and listings were last checked. Built,
  switched off until launch. [#483](https://github.com/Draco-Foundry/open-hangar/issues/483)
- **Store Highlights for Your Ships:** the store's What's New view highlights the new items
  that match your hangar. [#484](https://github.com/Draco-Foundry/open-hangar/issues/484)
- **Open on Website Buttons:** buttons in the extension that open the same page on
  openhangar.space. [#485](https://github.com/Draco-Foundry/open-hangar/issues/485)
- **Front Page Polish:** a cleaner top of the front page [#458](https://github.com/Draco-Foundry/open-hangar/issues/458),
  and tidier cards in the middle [#435](https://github.com/Draco-Foundry/open-hangar/issues/435).

Plus behind-the-scenes work that keeps the site healthy and checks that everything is ready
before launch.

### Wave 2: Your Hangar Meets the Store (Built and in Testing by Oct 25)

Your own hangar, tied into the store and the news.
[Wave 2 Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/7)

- **Ship Details:** assigned paint, ship status and location for each ship you own, as your
  RSI account shows them, plus ships still in progress. [#486](https://github.com/Draco-Foundry/open-hangar/issues/486)
- **On Sale for Your Fleet:** store sales that fit ships you already own.
  [#487](https://github.com/Draco-Foundry/open-hangar/issues/487)
- **News About Your Ships:** news and RSI posts that mention ships in your hangar.
  [#488](https://github.com/Draco-Foundry/open-hangar/issues/488)
- **Last Seen on Sale:** on every ship's page, when RSI last sold it and at what price. The
  store's item panel already shows the last sale date. [#489](https://github.com/Draco-Foundry/open-hangar/issues/489)
- **Hide Owned Items:** shipped. The store can already hide what you own, for pilots with a
  synced hangar. [#490](https://github.com/Draco-Foundry/open-hangar/issues/490)
- **Wishlist:** the ships you want, on the website, with an on-sale check. The extension's
  wishlist stays too. [#491](https://github.com/Draco-Foundry/open-hangar/issues/491)
- **Pledge Notes:** your own private notes on any pledge. [#492](https://github.com/Draco-Foundry/open-hangar/issues/492)
- **Stats:** your hangar's numbers on the website, for you alone. [#493](https://github.com/Draco-Foundry/open-hangar/issues/493)
- **Referral Stats:** your recruits and reward progress on the website.
  [#494](https://github.com/Draco-Foundry/open-hangar/issues/494)
- **Compare Ships:** a full ship-versus-ship page, beyond the store's three-item compare.
  [#495](https://github.com/Draco-Foundry/open-hangar/issues/495)
- **First-Run Tour:** a short guided tour the first time you open My Hangar.
  [#496](https://github.com/Draco-Foundry/open-hangar/issues/496)
- **Hangar Downloads:** your pledges, fleet and buy-backs as CSV or JSON from the website, on
  any device. Download My Data on your Account page is already live.
  [#497](https://github.com/Draco-Foundry/open-hangar/issues/497)
- **Site Search:** one search box for the whole website. [#498](https://github.com/Draco-Foundry/open-hangar/issues/498)

### Bug Fixes and Beta (Oct 16 to 27)

[Bug Fixes and Beta Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/8)

- **Bug-Fix Days (Oct 16 to 19):** fixes and polish only, so the beta starts on solid ground.
  [#507](https://github.com/Draco-Foundry/open-hangar/issues/507)
- **Front Page Fixes:** canceled events keep their strike-through on hover
  [#457](https://github.com/Draco-Foundry/open-hangar/issues/457), the top stories pause when you hover
  [#459](https://github.com/Draco-Foundry/open-hangar/issues/459), and on phones Ships in the News
  leads with the newest story [#467](https://github.com/Draco-Foundry/open-hangar/issues/467).
- **Org Fleet, Ships Only:** taking member values and comparisons out of the extension's Org
  Fleet page. [#466](https://github.com/Draco-Foundry/open-hangar/issues/466)
- **Beta (Oct 20 to 27):** 5 to 10 Discord testers try 0.3.0 and the website together, sync
  included. [#508](https://github.com/Draco-Foundry/open-hangar/issues/508)
- **One Sync Format for Both:** the extension and the website share one description of what
  a sync contains, if it's ready by Oct 27. [#441](https://github.com/Draco-Foundry/open-hangar/issues/441)
- **Code Freeze and Final Check (Oct 27):** last extension changes in, then a go or no-go call
  on sending 0.3.0 to the stores. [#509](https://github.com/Draco-Foundry/open-hangar/issues/509)

### Wave 3: Finishing Touches (Built by Nov 3)

The last round before launch. [Wave 3 Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/9)

- **Recommendations:** simple, rule-based suggestions for your hangar, each with its reason.
  [#499](https://github.com/Draco-Foundry/open-hangar/issues/499)
- **Upgrade Price From Your Ships:** what a direct upgrade to a ship costs from each ship you
  own. [#500](https://github.com/Draco-Foundry/open-hangar/issues/500)
- **Calendar Export:** add Star Citizen events to your own calendar app.
  [#501](https://github.com/Draco-Foundry/open-hangar/issues/501)
- **Link Previews:** openhangar.space links show a proper picture and title when shared.
  [#502](https://github.com/Draco-Foundry/open-hangar/issues/502)
- **Open Hangar Updates Page:** every Open Hangar update, for the extension and the website,
  newest first. [#503](https://github.com/Draco-Foundry/open-hangar/issues/503)
- **Feedback Button:** send feedback from any page. [#504](https://github.com/Draco-Foundry/open-hangar/issues/504)
- **Donation Link:** an optional Support Open Hangar link across the website. Donations are
  optional and never unlock features. [#505](https://github.com/Draco-Foundry/open-hangar/issues/505)
- **Accessibility Pass:** keyboard, screen reader, focus and contrast checks across the
  website. [#506](https://github.com/Draco-Foundry/open-hangar/issues/506)

### Launch Tasks for the Extension

[Launch Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/4)

- **Easy-to-Find Connect** in the extension. [#434](https://github.com/Draco-Foundry/open-hangar/issues/434)
- **Bring the 0.3.0 Build Into Main** at code freeze. [#510](https://github.com/Draco-Foundry/open-hangar/issues/510)
- **Update the "No Server" Wording** everywhere it no longer fits.
  [#511](https://github.com/Draco-Foundry/open-hangar/issues/511)
- **Submit 0.3.0 to the Stores (Oct 28).** [#512](https://github.com/Draco-Foundry/open-hangar/issues/512)
- **Launch Day (Nov 10):** 0.3.0 and the website launch together, and sign-ups open to
  everyone. [#513](https://github.com/Draco-Foundry/open-hangar/issues/513)

### Already Built for 0.3.0

Done and waiting for launch day. The [0.3.0 Redesign](https://github.com/Draco-Foundry/open-hangar/milestone/3)
milestone has every rebuilt page.

- **A Rebuilt Extension:** every page redone for speed in one clean look, with a filters
  sidebar on Inventory and Buy-Backs, and a clearer top menu. [#260](https://github.com/Draco-Foundry/open-hangar/issues/260)
- **Optional Sync:** connect a free openhangar.space account in one click and every scan
  syncs on its own. Disconnect any time. It's switched on in the 0.3.0 store build
  ([#461](https://github.com/Draco-Foundry/open-hangar/pull/461)), and the website opens sync
  to everyone at launch.
- **My Hangar on the Website:** your synced hangar on any device (beta testers only until
  launch).
- **A New Home:** a full-width Citizen Card, Account Value with your most valuable ships,
  Latest Acquisitions, Wishlist Watch and layouts you can customize.
- **Game Status in the Top Bar,** plus Subscriber and Chairman's Club details on your Citizen
  Card.
- **Your Subscriber Store** on the Store page, while the full price list moves to the website
  store.
- **Add to RSI Cart** for ship upgrades and buy-back upgrades, from the extension or the
  website store.
- **Melt With the Facts First,** and clear labels on pledges RSI never sells back.
  [#403](https://github.com/Draco-Foundry/open-hangar/issues/403)
- **Pledge Archive:** pledges that leave your hangar are kept, in backups and in sync, with a
  storage check after each scan. [#388](https://github.com/Draco-Foundry/open-hangar/issues/388)
- **Buy-Back Packs Read Automatically** after a scan, using your own history first so RSI
  gets asked less.
- **RSI Quick Links:** one place to jump to your hangar, billing, settings, the launcher and
  more. [#374](https://github.com/Draco-Foundry/open-hangar/issues/374)
- **Clearer Problem Reports,** and a friendly note when you scan while signed out of RSI.
  [#315](https://github.com/Draco-Foundry/open-hangar/issues/315) [#314](https://github.com/Draco-Foundry/open-hangar/issues/314)
- **One Open Beta Card on Home** ahead of launch. [#371](https://github.com/Draco-Foundry/open-hangar/issues/371)
- **Talks Only to RSI and openhangar.space,** with no other outside sites.
- **Import Your Website Data** into the extension.

## After Launch

Plans, not promises. We update this page when they change.

### The First Four Weeks: Fixes and Upkeep

After Nov 10, four weeks of bug fixes and keeping ship and store data accurate, with no new
features. [After Launch Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/5)

- **Ship Data You Can Trust:** one stable record for each ship, so names and pictures stay
  right when RSI renames something. [#337](https://github.com/Draco-Foundry/open-hangar/issues/337)

### December 2026: Community (Wave 4)

Open Hangar for your org and your crew, on the website. Ships only, never prices or what
anyone paid, and no rankings. [Wave 4 Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/10)

- **Org Fleet:** your org's ships together on the website. Ships only, never prices or what
  anyone paid. [#514](https://github.com/Draco-Foundry/open-hangar/issues/514)
- **Looking for Crew:** find crew for your ship, or a seat on someone else's.
  [#518](https://github.com/Draco-Foundry/open-hangar/issues/518)
- **Events:** plan events and share them publicly, with your org, or privately.
  [#519](https://github.com/Draco-Foundry/open-hangar/issues/519)
- **Roles I Play:** say which roles you like to fly, so crews and orgs can find you.
  [#515](https://github.com/Draco-Foundry/open-hangar/issues/515)
- **Citizen Profile:** an optional profile that shows only what you choose to share.
  [#516](https://github.com/Draco-Foundry/open-hangar/issues/516)
- **Moderation Tools:** to keep community pages friendly and safe.
  [#517](https://github.com/Draco-Foundry/open-hangar/issues/517)
- **Phone Alerts:** optional alerts on your phone for the things you follow.
  [#520](https://github.com/Draco-Foundry/open-hangar/issues/520)

### Early 2027

Planned, not promised. The order may change.
[Early 2027 Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/11)

- **Value and Savings:** your hangar's value and what you've saved, on the website, going
  further than the extension's Account Value. Facts, never financial advice.
  [#521](https://github.com/Draco-Foundry/open-hangar/issues/521)
- **Trade Post Builder:** turn the pledges you pick into a tidy, ready-to-paste trade post.
  [#522](https://github.com/Draco-Foundry/open-hangar/issues/522)
- **Sale Calendar:** RSI's sales through the year on one calendar, from past store history.
  [#523](https://github.com/Draco-Foundry/open-hangar/issues/523)
- **Hangar Timeline:** your fleet's story over time, scan by scan.
  [#524](https://github.com/Draco-Foundry/open-hangar/issues/524)
- **Shareable Fleet Card:** a good-looking card of your fleet to post on Discord or forums.
  [#525](https://github.com/Draco-Foundry/open-hangar/issues/525)
- **Store Credit Check:** a closer look at your store credit on the website, beyond the
  balance the extension shows today. [#526](https://github.com/Draco-Foundry/open-hangar/issues/526)

### Later in 2027

Planned, not promised. The order may change.
[Later in 2027 Milestone](https://github.com/Draco-Foundry/open-hangar/milestone/12)

- **Org Matchmaking:** help pilots and orgs find a good fit. [#527](https://github.com/Draco-Foundry/open-hangar/issues/527)
- **Year in Review:** a look back at your year in the 'verse. [#528](https://github.com/Draco-Foundry/open-hangar/issues/528)
- **Start a Scan From the Website:** refresh your hangar without opening the extension.
  [#529](https://github.com/Draco-Foundry/open-hangar/issues/529)
- **More Languages:** one language at a time [#530](https://github.com/Draco-Foundry/open-hangar/issues/530), starting with a German
  word list [#301](https://github.com/Draco-Foundry/open-hangar/issues/301).

### Ideas With No Date Yet

On the list, but not scheduled. Vote for the ones you want in
[Ideas Discussions](https://github.com/Draco-Foundry/open-hangar/discussions/categories/ideas).

- **Upgrades, Serials and Nameable Ships,** read from RSI's own data.
  [#297](https://github.com/Draco-Foundry/open-hangar/issues/297)
- **Your Concierge Store,** read for your own account, with the website store marking what's
  available to you. [#418](https://github.com/Draco-Foundry/open-hangar/issues/418)
- **More Account Data:** upgrade history, your store credit log and badges.
  [#300](https://github.com/Draco-Foundry/open-hangar/issues/300)
- **A Melt and Buy-Back Advisor,** which may become part of Value and Savings.
  [#293](https://github.com/Draco-Foundry/open-hangar/issues/293)

## Not Planned, and Why

**Never:**

- **Rankings, or Comparing Players' Hangars.** We don't rank pilots or orgs, or compare
  totals, values or ship counts between players. Stats stay anonymous and hangars stay private
  by default. One exception is still to fix: the extension's Org Fleet page shows member
  values and comparisons today, and taking them out is tracked in
  [#466](https://github.com/Draco-Foundry/open-hangar/issues/466).
- **CCU Chain Planning.** Open Hangar shows what your upgrades are worth, and from 0.3.0 what
  a single upgrade costs from a ship you own. Planning whole chains is left to the tools built
  for it.
- **Reading Anyone Else's Account.** Open Hangar only ever reads your own.

**Removed From Plans:**

- **Safari.** The extension stays on Chrome, Edge and Firefox (Brave, Opera and Vivaldi use
  the Chrome build). The website works in any modern browser.
- **A Data API for Other Sites.** An opt-in way for other websites to ask the extension for
  your data is no longer planned. From 0.3.0 the extension talks only to RSI and
  openhangar.space.

## Shipped

Newest first. Dates are UTC. Full notes for every version are on the
[Releases](https://github.com/Draco-Foundry/open-hangar/releases) page and in the
[Changelog](CHANGELOG.md).

### October 2026

- [x] **Oct 6 to 7 · Website:** the [Open Hangar Beta](https://openhangar.space/beta) page for
      Discord testers, with what to test and how to install the test build.
- [x] **Oct 6 to 7 · Website:** a fresh front page with today's top stories, Ships in the
      News, a Patch, Roadmap and Issues card, and each subscriber tier's Vehicle of the Month.
      ([Visit openhangar.space](https://openhangar.space/))
- [x] **Oct 6 to 7 · Website:** the store adds Compare (up to three items side by side),
      prices in your own currency and a What's New view of the latest drops. Pilots with a
      synced hangar (beta testers until launch) see an In Your Hangar mark on what they own,
      and can hide owned items. ([Browse the Store](https://openhangar.space/store))
- [x] **Oct 5 · 0.2.18 and 0.2.19:** Reclaim on an upgrade buy-back opens the right item, and
      the next buy-back token date keeps working past RSI's posted 2026 dates.
      ([0.2.18](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.18),
      [0.2.19](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.19))
- [x] **Oct 4 · Website:** one page to get Open Hangar, showing each store's current version.
      ([Get the Extension](https://openhangar.space/extension))
- [x] **Oct 4 · 0.2.17:** much faster rescans when nothing has changed, full-size pictures,
      and an Open Beta note ahead of the Nov 10 launch.
      ([Release Notes](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.17))
- [x] **Oct 3 · 0.2.16:** scans ride out a busy RSI and warn early when RSI changes its hangar
      page. ([Release Notes](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.16))
- [x] **Oct 3 · Website:** the Open Hangar Store lists every item RSI sells, with its sale
      history, how often RSI sells it, insurance, filters and saved views.
      ([Browse the Store](https://openhangar.space/store))
- [x] **Oct 2 · Website:** the openhangar.space front page becomes a Star Citizen news hub,
      with game status, an events calendar, what's live now, ships in the news and short
      summaries of official RSI posts.
- [x] **Oct 1 · Milestones:** [Ready for Players](https://github.com/Draco-Foundry/open-hangar/milestone/1) (24 issues)
      and [Foundation](https://github.com/Draco-Foundry/open-hangar/milestone/2) (14 issues) are done: safer releases, a way to
      pause a broken scan, faster big hangars, better search and the groundwork to grow on.
- [x] **Oct 1 · 0.2.13 to 0.2.15:** big hangars open fast and Account Value counts everything
      you own. A broken scan can be paused without a store update. Also new: Known Issues,
      Report a Scan Problem, keyboard and screen reader support, and a Star Citizen voice
      throughout. ([0.2.13](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.13),
      [0.2.14](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.14),
      [0.2.15](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.15))

### September 2026

- [x] **Sep 30 · 0.2.12:** a new, cleaner look. Home is rebuilt with Account Value, Game
      Status and Hangar Alerts, plus a new Citizen Card, Streamer Mode and a Melt Planner.
      ([Release Notes](https://github.com/Draco-Foundry/open-hangar/releases/tag/v0.2.12))
- [x] **Sep 30 · Edge:** live on Microsoft Edge Add-ons, so all three browsers are covered.
      ([PR #145](https://github.com/Draco-Foundry/open-hangar/pull/145))
- [x] **Sep 30 · 0.2.11:** a Wishlist with an In Store Now check, Global Hangar Search, ship
      details with loaners, and a referral share image.
      ([PR #140](https://github.com/Draco-Foundry/open-hangar/pull/140))
- [x] **Sep 29 · 0.2.10:** Buy-Backs Market tools (pick items, see totals, compare with the
      store price, export) and a store listing in 11 languages.
      ([PR #106](https://github.com/Draco-Foundry/open-hangar/pull/106))
- [x] **Sep 28 · 0.2.9:** Org Fleet puts your members' ship lists together as one fleet. Also:
      buy-back details and token count, amounts in your own currency, and alt accounts that
      keep their own data. ([PR #97](https://github.com/Draco-Foundry/open-hangar/pull/97))
- [x] **Sep 28 · 0.2.8:** hangar value at today's store prices, history between scans, fleet
      stats, meltable and giftable tags, more filters and a fleet picture to share.
      ([PR #49](https://github.com/Draco-Foundry/open-hangar/pull/49))
- [x] **Sep 28 · Chrome and Firefox:** live on the Chrome Web Store and Firefox Add-ons, both
      with 0.2.7. ([PR #44](https://github.com/Draco-Foundry/open-hangar/pull/44),
      [PR #67](https://github.com/Draco-Foundry/open-hangar/pull/67))
- [x] **Sep 25 · 0.2.7:** the first store build goes to Chrome, Edge and Firefox for review,
      and a first openhangar.space page goes up.
      ([PR #3](https://github.com/Draco-Foundry/open-hangar/pull/3))

### June 2026

- [x] **Jun 7 · 0.2.0:** a Referrals page with your recruits, prospects, reward tiers, event
      bonuses and charts. ([Changelog](CHANGELOG.md))
- [x] **Jun 1 · 0.1.0:** first code on GitHub. Open Hangar reads your own RSI hangar,
      buy-backs and balances into a local database you can browse and export.
      ([0.1.0 Commit](https://github.com/Draco-Foundry/open-hangar/commit/22c5578))

## How This Page Stays Current

- Every roadmap item is a GitHub issue in a milestone, so the progress bars and the tracker's
  count update themselves as issues close.
- This page changes when a step finishes: we tick it, add a line to Shipped and update the
  date at the top. We also re-read it at least once a month.
- Release notes come from the [Changelog](CHANGELOG.md) with every release.
- This repo holds the extension's code. Website features are tracked here as issues too.

## For Contributors

How the extension reads RSI and how data sources work are in the
[Architecture Tour](ARCHITECTURE.md) and the [Contributing Guide](CONTRIBUTING.md). What is
and isn't read is in the [Extension Privacy Policy](https://openhangar.space/privacy.html).

**Privacy Rules for New Sources:** fleet data by default. Anything financial or personal
(billing, transactions, addresses) stays out, or is opt-in and off by default, and is never
part of anything shared.
