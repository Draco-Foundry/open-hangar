# Privacy Policy — Open Hangar

_Last updated: 2026-11-10_

Open Hangar is a source-available browser extension that reads your own Star Citizen /
Roberts Space Industries (RSI) account data and stores it **locally in your
browser**. This policy explains exactly what it does and does not do with data.

## The short version

- **No account, no password, no sign-up needed.** Open Hangar uses the RSI session you
  are already signed in with in your browser, and works fully on its own.
- **Your data stays on your device unless you choose to sync.** Syncing to our website,
  app.openhangar.space, is optional and off until you connect an account and press
  Sync. Until then nothing is sent to us.
- **We do not sell or share your personal data.** Without sync we collect nothing; with
  sync we keep only what you send (see [Optional Sync](#optional-sync-to-openhangarspace)).

## What data is accessed and where it is stored

When you click **Scan**, the extension reads **your own** RSI account by making
requests to robertsspaceindustries.com using your existing browser session, and
parses the results locally. This may include:

- Your hangar (pledges: ships, CCUs, add-ons, coupons)
- If you use more than one RSI account in this browser, each account's scans are kept
  separately so they don't overwrite each other
- Any org members' ship lists you choose to import on the Org Fleet page (ship names
  and LTI only)
- A short history of past hangar scans (pledge id, name and value per scan), so
  the extension can show what changed between scans (kept only here, and included
  in the JSON backup file you can download yourself)
- Your buy-back pledges
- Account identity and balances (handle, display name, org, rank, Store Credit,
  UEC, REC)
- Your referral code and your recruits/prospects (handles, monikers, dates)

All of this is stored **only** in your browser's local extension storage
(`chrome.storage.local`). It is only sent anywhere if you turn on sync (below), and
never to anyone else. You can remove it at any time with **Clear Data** in the settings menu (click your portrait), or by
uninstalling the extension (which deletes all stored data).

## Outbound network requests

The extension makes a small number of outbound requests, none of which carry your
personal data:

- **robertsspaceindustries.com** — to read your own account (above), to load hangar
  thumbnails, to show RSI's newest Comm-Links, This Week in Star Citizen and patch notes
  on the Home page (the same public pages for everyone), to look up ship art for items
  RSI ships without images from RSI's public ship-matrix index, and, only when you
  choose to scan the Store, to check whether the ships on your wishlist are on sale.
  No credentials are sent for the ship-matrix lookup.

- **api.star-citizen.wiki** (public, read-only) — the current game version and when
  it was released, a fallback for ship art when the ship-matrix has no image, and the source of ship
  store prices for Hangar value. Prices come from downloading the whole public
  vehicle list (the same list for everyone), so they reveal nothing about your
  hangar. Ship-art lookups, done by ship name, are cached locally and are the only
  outbound signal that weakly relates to what you are viewing; no credentials or
  personal data are sent.
- **support.robertsspaceindustries.com** (public, read-only) — RSI's Loaner Ship
  Matrix and Included Vessels help articles (the same pages for everyone), at most once a week, to show
  which loaners your ships give you. No credentials or personal data are sent.
- **starcitizen.tools** (public, read-only) — the current game event and test-server
  versions on the Home page, and on the Referrals page the list of referral bonus events
  and the pictures of referral rewards (the same for everyone), cached for hours to a
  month. No credentials or personal data are sent.
- **openhangar.space** (our own site, public, read-only): a small status file (the same
  for everyone), at most every few hours, so we can pause a scan that RSI's site changes
  have broken and show a short notice until a fix is out; and, only if you pick a
  currency other than USD, today's exchange rates (the European Central Bank's, the same
  file for everyone), at most once a day. Nothing is sent. The site is
  hosted on Cloudflare, which, like any website host, sees the request's IP address; we
  receive nothing.
- **api.github.com** (public, read-only): only when you open the Known Issues page, the
  list of open bug reports for Open Hangar (the same list for everyone), cached for an
  hour. No credentials or personal data are sent.
- **addons.mozilla.org** (Firefox only, public, read-only) — when you press "Check for
  updates", the latest published version number of Open Hangar. No credentials or
  personal data are sent.

The footer also links to Ko-fi and Patreon, where you can choose to support the project.
They are plain links: nothing is loaded from either site, and nothing is sent unless you
click one and use that site yourself.

When a scan fails, **Report a Scan Problem** opens a new GitHub issue in your browser with
the scan summary (counts only) and the error report filled in: version, browser, item
counts and the recent log, with no handle, referral code or item names. Nothing is sent by
the extension. You read it on GitHub and decide whether to submit it.

## Optional Sync to openhangar.space

Sync lets you see your hangar on any device. It is off until you turn it on, and the
extension works the same without it.

- **Connecting:** press **Connect to openhangar.space** on the Home page, then sign in on
  app.openhangar.space and approve the code it shows. The extension then keeps a sync
  token in its local storage. Connecting sends nothing about your hangar.
- **What is sent, and when:** only when you press **Sync Now**, or after each scan if you
  turn on **Sync After Every Scan** (off by default), the extension sends the same data
  as its JSON backup file: your hangar, buy-backs, scan history, account identity and
  balances (handle, display name, org, rank, Store Credit, UEC, REC) and your referral
  recruits list. Your referral code is never sent, and neither is your RSI password or
  any RSI cookie.
- **No extra RSI requests:** sync sends what the extension already has; it never reads
  anything more from RSI.
- **Requests while connected:** only to app.openhangar.space, to connect (a short code,
  then checks until you approve it), to sync, and to disconnect.
- **Disconnecting:** **Disconnect** on the Home page stops syncing and cancels this
  extension's token. The copy already synced stays on the website until you delete it
  there; your Account page on the website can download or delete everything.
- **What the website keeps and for how long:** see the website's own privacy policy,
  https://app.openhangar.space/privacy. The website is run by Draco Foundry, LLC and
  hosted on Cloudflare.

## Permissions and why they are used

- **storage** — to save your scanned data and UI preferences locally.
- **unlimitedStorage** — big hangars and buy-back lists, plus scan history, can outgrow
  the browser's default 10 MB limit; this lifts the limit. Everything still stays on
  your device.
- **cookies** — used solely for "Log Out of RSI," which clears
  robertsspaceindustries.com cookies so you can fully end your RSI session from the
  extension. Cookie values are never read or transmitted.
- **host access** to robertsspaceindustries.com, to make
  the read-only requests described above.

## Data export

Open Hangar lets you export your database as a JSON file (or a CSV of what a page shows) that you choose to save.
That file is created locally and handled entirely by you; the extension does not
upload it anywhere. (Only Sync sends the same data, and only if you turned sync on.) (Your referral code is deliberately excluded from exports.)

## Multiple accounts

Scanned data is tied to the RSI account it came from. Each account's data is kept
separately in this browser: when you sign in to RSI with a different account, Open
Hangar shows that account's last scan (or asks for a first scan), and the other
account's data waits until you sign in as them again. Accounts never mix. You can see
and remove saved accounts on the Developers page.

## Changes to this policy

Material changes will be noted in the project's repository and the "Last updated"
date above.

## Contact

Email support@openhangar.space, or open an issue on GitHub:
https://github.com/Draco-Foundry/open-hangar/issues

_Unofficial, fan-made, and not affiliated with Cloud Imperium Games or RSI._
