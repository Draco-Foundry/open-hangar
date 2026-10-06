# Privacy Policy: Open Hangar

**Last updated: 2026-11-10**

Open Hangar is a source-available browser extension that reads your own Star Citizen / Roberts Space Industries (RSI) account data and stores it locally in your browser. This policy explains exactly what it does and does not do with data.

## The short version

- No account, no password, no sign-up needed. Open Hangar uses the RSI session you are already signed in with in your browser, and works fully on its own.
- Your data stays on your device unless you choose to sync. Syncing to our website, app.openhangar.space, is optional and off until you connect. Once you connect, the extension syncs after every successful scan. Until then nothing is sent to us.
- Open Hangar only reads your RSI account, with one exception: when you click Add to RSI Cart, it puts that upgrade in your RSI cart. It never checks out or pays.
- We do not sell or share your personal data. Without sync we collect nothing; with sync we keep only what you send (see [Optional Sync](#optional-sync-to-openhangarspace)).

## What data is accessed and where it is stored

When you click Scan, the extension reads your own RSI account by making requests to robertsspaceindustries.com using your existing browser session, and parses the results locally. This may include:

- Your hangar (pledges: ships, CCUs, add-ons, coupons).
- A short history of past hangar scans (pledge id, name and value per scan), so the extension can show what changed between scans.
- An archive of pledges that have left your hangar (melted, gifted or upgraded away): pledge id, name, value, insurance, contents and dates, for up to the newest 2,000. It is used to fill in buy-back details.
- Your buy-back pledges. After a good buy-back scan, the extension also opens up to 30 buy-back packs it hasn't read yet, to see what is inside each one. This means more requests to RSI than one page per scan. It is still read-only, and only ever your own account.
- Account identity and balances (handle, display name, UEE Citizen Record number, org, rank, Store Credit, UEC, REC). The Citizen Record number is the public number on your RSI profile. It never changes.
- Your referral code and your recruits/prospects (handles, monikers, dates).
- If you're a subscriber: the subscriber-only items RSI offers your account (names, pictures, prices and availability), at most once a day, to show them on the Store page. Nothing about them is sent to us unless you sync.
- Any org members' ship lists you choose to import on the Org Fleet page (ship names and LTI only).

If you use more than one RSI account in this browser, each account's data is kept separately so they don't overwrite each other (see [Multiple accounts](#multiple-accounts)).

All of this is stored only in your browser's local extension storage (`chrome.storage.local`). It is only sent to us if you connect sync (below), and never to anyone else. You can remove it at any time with Clear Data in the settings menu (click your portrait), or by uninstalling the extension (which deletes all stored data).

## Add to RSI Cart

When you click Add to RSI Cart on a ship upgrade (CCU), the extension uses RSI's own upgrade store, with your existing RSI session, to put that upgrade in your RSI cart.

- It sends RSI only the ship and upgrade ids, plus the buy-back pledge id when the upgrade is a buy-back.
- It never checks out or pays. You finish the purchase on RSI yourself.
- It only happens when you click the button.
- This is the only thing the extension does on RSI that isn't read-only.
- Nothing about it is sent to us.

On the Open Hangar store at openhangar.space, the extension can show you these upgrade prices and add upgrades for you. The page then sees which of your ships can be upgraded and RSI's prices, inside your browser only. Nothing reaches our server.

## Outbound network requests

Besides reading your own RSI account and Add to RSI Cart (both above), Open Hangar only ever talks to two places: RSI and our own site, openhangar.space. None of these requests carry your personal data.

- robertsspaceindustries.com (including support.robertsspaceindustries.com): to load hangar thumbnails; to look up ship art for items RSI ships without images, from RSI's public ship-matrix index; and RSI's Loaner Ship Matrix and Included Vessels help articles (the same pages for everyone), at most once a week, to show which loaners your ships give you. No credentials are sent for these public pages.
- openhangar.space (our own site, public, read-only). Every file below is the same for everyone and is cached on your device:
  - a small status file, at most every few hours, so we can pause a scan that RSI's site changes have broken and show a short notice until a fix is out;
  - today's exchange rates (the European Central Bank's), only if you pick a currency other than USD, at most once a day;
  - the game status for the Game Status button: the live and test builds, the newest patch notes and the current and next game event, at most every 10 minutes;
  - the public ship list (names, store prices and pictures) for Hangar value and ship art;
  - the public store catalog (what's on sale now, with prices), when you press Check Now or scan the Store. Open Hangar downloads the whole catalog and checks your wishlist on your own device, so your wishlist is never sent anywhere;
  - the list of referral bonus events and reward pictures, for the Referrals page;
  - the list of open bug reports for Open Hangar, when you open the Known Issues page;
  - on Firefox, when you press "Check for Updates", the latest published version number.

  Nothing is sent to us by these requests. The site is hosted on Cloudflare, which, like any website host, sees the request's IP address; we keep nothing from it except a short-lived count per address to stop abuse.

The site gathers some of this public information from community sources, such as the Star Citizen Wiki and starcitizen.tools, and credits them where it shows it. Open Hangar itself doesn't contact them.

The footer also links to Ko-fi and Patreon, where you can choose to support the project, and some pages link to community sites such as the Star Citizen Wiki. They are plain links: nothing is loaded from those sites, and nothing is sent unless you click one and use that site yourself.

When a scan fails, Report a Scan Problem opens a new GitHub issue in your browser with the scan summary (counts only) and the error report filled in: version, browser, item counts and the recent log, with no handle, Citizen Record number, referral code or item names. Nothing is sent by the extension. You read it on GitHub and decide whether to submit it.

## Optional Sync to openhangar.space

Sync lets you see your hangar on any device. It is off until you connect, and the extension works the same without it.

- **Connecting:** press Connect to openhangar.space on the Home page, then sign in on app.openhangar.space and approve the code it shows. The extension then keeps a sync token in its local storage. Connecting sends nothing about your hangar.
- **What is sent, and when:** once connected, the extension syncs automatically after every successful scan. There is nothing to press and no setting to turn on. Each sync sends the same data as its JSON backup file: your hangar, buy-backs (including what is inside each pack), scan history, pledge archive, account identity and balances (handle, display name, UEE Citizen Record number, org, rank, Store Credit, UEC, REC) and your referral recruits list. The Citizen Record number lets the website keep the same account and history if you change your RSI handle. Your referral code is never sent, and neither is your RSI password or any RSI cookie.
- **No extra RSI requests:** sync sends what the extension already has. It never reads anything more from RSI.
- **Requests while connected:** only to app.openhangar.space, to connect (a short code, then checks until you approve it), to sync, and to disconnect.
- **Disconnecting:** Disconnect in the settings menu (click your portrait) stops syncing and cancels this extension's token. The copy already synced stays on the website until you delete it there; your Account page on the website can download or delete everything.
- **Inactive accounts:** if a website account has no sign-in and no sync for 24 months, the website deletes it along with all its synced data. It emails you 6 months before, and again 30 days before. Signing in or syncing resets the clock. Data in the extension itself is not affected.
- **What the website keeps and for how long:** see the website's own privacy policy, https://app.openhangar.space/privacy. The website is run by Draco Foundry, LLC and hosted on Cloudflare.

## Permissions and why they are used

- **storage:** to save your scanned data and UI preferences locally.
- **unlimitedStorage:** big hangars and buy-back lists, plus scan history and the pledge archive, can outgrow the browser's default 10 MB limit; this lifts the limit. Everything still stays on your device.
- **cookies:** used solely for "Log Out of RSI", which clears robertsspaceindustries.com cookies so you can fully end your RSI session from the extension. Cookie values are never read or transmitted.
- **Host access to robertsspaceindustries.com:** to make the read-only requests described above, and to add an upgrade to your RSI cart when you click Add to RSI Cart.

## Data export

Open Hangar lets you export your database as a JSON file (or a CSV of what a page shows) that you choose to save. The JSON file includes your scan history and pledge archive. That file is created locally and handled entirely by you; the extension does not upload it anywhere. (Only sync sends the same data, and only if you connected it.) Your referral code is deliberately left out of exports.

## Multiple accounts

Scanned data is tied to the RSI account it came from. Each account's data is kept separately in this browser: when you sign in to RSI with a different account, Open Hangar shows that account's last scan (or asks for a first scan), and the other account's data waits until you sign in as them again. Accounts never mix. You can see and remove saved accounts on the Developers page.

## Changes to this policy

Material changes will be noted in the project's repository and the "Last updated" date above.

## Contact

Email [support@openhangar.space](mailto:support@openhangar.space), or open an issue on GitHub: https://github.com/Draco-Foundry/open-hangar/issues

Unofficial, fan-made, and not affiliated with Cloud Imperium Games or RSI.
