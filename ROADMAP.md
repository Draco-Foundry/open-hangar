# Roadmap

Where Open Hangar is headed. Dates are UTC. For what already shipped, see
[CHANGELOG.md](CHANGELOG.md); for open work, see the
[issues](https://github.com/Draco-Foundry/open-hangar/issues) and their milestones.

_Last updated: 2026-10-08_

## Where We Are

**0.2.19 is live** on Chrome, Edge and Firefox. It reads your own RSI account in your
browser and turns it into something you can use:

- Your hangar: ships, CCUs, add-ons, coupons, values, melt value and LTI
- Buy-backs, with Reclaim links that land on the right item on RSI
- Stats, store prices and what your CCUs are worth
- Referrals and recruits
- Org Fleet from imported member lists
- Fleet pictures you can share
- JSON and CSV export, and JSON import

Everything stays in your browser. Nothing is sent anywhere unless you choose to.

## 0.3.0: Launch, November 10, 2026

A full rebuild with one clean look, plus the website at
[app.openhangar.space](https://app.openhangar.space).

**What's in it**

- **A rebuilt app.** Every page redone for speed and a cleaner layout, with search across
  your whole hangar.
- **Optional sync.** Connect a free account and your hangar shows up on the website, on
  any device. It stays optional: without it, nothing leaves your browser.
- **Buy-back and melt help.** What you'd lose before you melt something, the ones RSI
  never sells back, and what a buy-back really costs.
- **Your data, safer.** The pledge archive keeps pledges that left your hangar, backups
  carry it, and a storage check catches anything growing out of control.
- **Clearer problem reports**, and a friendly message when you scan while signed out of
  RSI.
- **RSI Quick Links:** one place to jump to your hangar, settings, game packages and
  more on RSI.

**Timeline**

| Date (UTC)   | Milestone                                          |
| ------------ | -------------------------------------------------- |
| Oct 16       | Feature complete: fixes and polish only after this |
| Oct 20 to 27 | Beta with testers from our Discord                 |
| Oct 27       | Code freeze and go/no-go                           |
| Oct 28       | Submitted to the Chrome, Edge and Firefox stores   |
| Nov 10       | Launch                                             |

Want to help test? Join the [Draco Foundry Discord](https://discord.gg/FF8Wm5HdnV) and
ask for the Beta Tester role.

## After Launch

From 0.3.0 on, the extension gets reading improvements and fixes, and new features land
on the website. Store listing languages come back one at a time after launch. The player
roadmap moves to **openhangar.space/whats-next** at launch.

## Not Planned

- **CCU chain planning.** Other community tools do this well. Open Hangar shows what your
  CCUs are worth and leaves the planning to them.
- **Rankings of pilots or orgs.** Stats stay anonymous and hangars stay private.
- **Anything that reads another player's account.** Open Hangar only ever reads your own.

## How It Works (for contributors)

Open Hangar reads RSI two ways: server-rendered pages (hangar, buy-backs), parsed in the
browser, and RSI's own GraphQL endpoints (referrals, store data). Every data source is
an entry in `OH.SOURCES` in `src/lib.js`, saved under one versioned key. Adding a
source means one registry entry plus a parser. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the full picture, and [docs/PRIVACY.md](docs/PRIVACY.md) for what is and isn't
read.

**Privacy rules for new sources:** fleet data by default. Anything financial or personal
(billing, transactions, addresses) stays out, or opt-in and off by default, and is never
part of anything shared.
