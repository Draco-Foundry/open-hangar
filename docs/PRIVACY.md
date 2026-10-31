# Privacy Policy: Open Hangar

**Last updated: 2026-10-26**

Open Hangar is a source-available browser extension that reads your own Star Citizen / Roberts Space Industries (RSI) account data and stores it locally in your browser. Open Hangar works from its toolbar popup, which holds your hangar's summary, your Wishlist and your settings. Scans run in a hidden page, so no tab opens. A small Open Hangar page opens only when the extension needs to ask you something, or when a scan can't run hidden. Your full hangar is on our website, openhangar.space. This policy explains exactly what it does and does not do with data.

## The short version

- No account, no password, no sign-up needed. Open Hangar uses the RSI session you are already signed in with in your browser. The extension and our hangar page, hangar.openhangar.space, work without an account.
- Your data stays on your device unless you choose to sync. Syncing to our website, app.openhangar.space, is optional and off until you connect. Once you connect, the extension syncs after every successful scan. Until then nothing is sent to us.
- Open Hangar only reads your RSI account, with one exception: when you click Add to RSI Cart or Send to RSI Cart, it puts what you picked in your RSI cart. It never checks out or pays.
- Store alerts are optional. They're on only while you're connected and an item on your Wishlist has Remind Me on. They download one public sale file, the same for everyone, and match it on your device (see [Store Alerts](#store-alerts)).
- The Daily Scan Reminder is optional and off until you turn it on. It works only while you're connected. It reminds you to scan and reads nothing itself: Open Hangar scans only when you click (see [Daily Scan Reminder](#daily-scan-reminder)).
- We do not sell or share your personal data. Without sync we collect nothing; with sync we keep only what you send (see [Optional Sync](#optional-sync-to-openhangarspace)).

## What data is accessed and where it is stored

When you press Scan in the toolbar popup, or click the Daily Scan Reminder's notification (see [Daily Scan Reminder](#daily-scan-reminder)), the extension reads your own RSI account by making requests to robertsspaceindustries.com using your existing browser session, and parses the results locally. The scan runs in a hidden page, so no tab opens. If it can't run there, it runs on the small Open Hangar page instead. This may include:

- Your hangar (pledges: ships, CCUs, add-ons, coupons).
- A short history of past hangar scans (pledge id, name and value per scan, and your Store Credit and UEC at each scan), so the extension can show what changed between scans.
- An archive of pledges that have left your hangar (melted, gifted or upgraded away): pledge id, name, value, insurance, contents and dates, for up to the newest 2,000. It is used to fill in buy-back details.
- Your buy-back pledges. When you press Scan, after a good buy-back scan, the extension also opens the RSI page of up to 30 buy-backs it hasn't read yet, to see each one's price, insurance and what is inside it. Buy-back upgrades have no page of their own, so they're left out. This means more requests to RSI than one page per scan. It is still read-only, and only ever your own account.
- Account identity and balances (handle, display name, the web address of your RSI portrait, UEE Citizen Record number, enlisted date, country, org (name, tag and logo address) and rank, whether you're a subscriber (with your tier and billing period, as RSI shows them), your Concierge level and how close you are to the next one, Store Credit, UEC, REC, Buy-Back Tokens, and when it was read). The Citizen Record number is the public number on your RSI profile. It never changes.
- A small copy of your RSI portrait, saved in this browser so the popup can show which account you're on. The copy itself isn't synced or put in your backup file. Its web address is part of your account identity (above).
- Your referral code, how many recruits and prospects you have, and each one's dates (when they enlisted and converted, and for a recruit, its referral campaign). Not their handles, names or pictures.

If you use more than one RSI account in this browser, each account's data is kept separately so they don't overwrite each other (see [Multiple accounts](#multiple-accounts)).

All of this is stored only in your browser's local extension storage (`chrome.storage.local`). It is only sent to us if you connect sync (below), and never to anyone else. You can remove it at any time with Clear Data on the popup's Settings tab, or by uninstalling the extension (which deletes all stored data). If a save is ever damaged, the extension keeps a recovery copy for at most 30 days.

The toolbar popup shows what's already stored in this browser: your RSI portrait and handle, your Account Value, Store Credit, UEC, REC and Buy-Back Tokens, how your Account Value and UEC changed since an earlier scan, the pledges that are new since your last scan, Fleet News, store alerts and whether sync is connected. Fleet News is up to three short notes about your own ships and your Wishlist, worked out on your device. The popup asks RSI for nothing itself, except the pictures of those new pledges: it loads them from RSI's own servers, the same way RSI's hangar page loads them, and sends RSI nothing else. Its Scan button starts a scan in the hidden page, and closing the popup doesn't stop it. While you're connected, the popup also shows your Wishlist (see [Your Wishlist](#your-wishlist)).

## Daily Scan Reminder

The Daily Scan Reminder tells you when it's time to scan. It's optional and off until you turn it on, in the openhangar.space part of the popup's Settings tab, and it works only while you're connected.

- **When:** at most once a day, while your browser is open, if your last scan in this browser is more than a day old. It skips the day if we've paused scans (see [Outbound network requests](#outbound-network-requests)).
- **How:** a notification. Turning the reminder on asks your browser for permission to show notifications, and if you say no, the reminder stays off. Click the notification to scan. If you don't, nothing happens.
- **What it reads and sends:** nothing. It only checks the time of your last scan, saved in this browser. The scan you start from it is the same as pressing Scan (above), and it syncs like any other scan.
- **Turning it off:** on the same Settings tab. Disconnecting turns it off too.

## Add to RSI Cart

When you click Add to RSI Cart on a ship upgrade (CCU), the extension uses RSI's own upgrade store, with your existing RSI session, to put that upgrade in your RSI cart. It sends RSI only the ship and upgrade ids, plus the buy-back pledge id when the upgrade is a buy-back.

When you click Send to RSI Cart on the store at openhangar.space, the extension puts the items in your Haul (paints, ships, packs or gear) in your RSI cart in one request, with your existing RSI session. It sends RSI only each item's store id and how many you picked. The page then sees which items RSI added, and RSI's own message for any it turned down, inside your browser only.

For both:

- They never check out or pay. You finish the purchase on RSI yourself.
- They only happen when you click the button.
- They are the only things the extension does on RSI that aren't read-only.
- Nothing about them is sent to us.

## Store Alerts

Store alerts tell you when something in RSI's store is for you. They're optional: they're on only while you're connected and at least one item on your Wishlist has Remind Me on, and they're matched on your device.

- **What a check downloads:** one public file from our site, openhangar.space/api/store/on-sale, that lists what's on sale in RSI's store now. It's the same file for everyone, and nothing about you is in the request. A check runs at most every 30 minutes, and less often when our site is busy or can't be reached.
- **What it's matched against:** on your device, the items on your account's Wishlist that have Remind Me on (see [Your Wishlist](#your-wishlist)), and the hangar this browser scanned. For example, an item you're watching goes on sale, or a ship you own gets a new paint. What it matches stays here.
- **What you see:** the popup's Wishlist tab counts your Remind Me items on sale and lists what's on sale first. The number on the toolbar button counts the ones you haven't seen yet and, if you allow notifications, each one newly on sale gets a notification (up to three at a time, then one for the rest). Matches with your hangar show only in the popup's Fleet News. Clicking a match in Fleet News or a notification opens that item on openhangar.space.
- **Turning them off:** turn Remind Me off for every item on your Wishlist, or disconnect. The checks stop, and the matches saved for alerts are deleted from this browser.

## Your Wishlist

While you're connected, the popup's Wishlist tab shows the Wishlist on your openhangar.space account and lets you change it.

- **Reading it:** the extension reads your Wishlist from app.openhangar.space/api/v1/wishlist with its sync token, to show it in the popup and, with store alerts on, to match it (see [Store Alerts](#store-alerts)). A copy stays in this browser.
- **Changing it:** when you add or remove an item, or turn Remind Me on or off for it, the extension sends that one change to app.openhangar.space with its sync token: which item, and for Remind Me, on or off. Nothing else is sent with it.
- **Searching:** finding items to add happens on your device. What you type isn't sent anywhere.
- **Disconnecting** deletes the copy in this browser. Your Wishlist stays on your account.

## Outbound network requests

Besides reading your own RSI account, the popup's pictures of new pledges, the cart buttons, store alerts, your Wishlist (all above) and sync (below), Open Hangar only talks to our own public site, openhangar.space. None of these requests carry your personal data.

- openhangar.space (our own site, public, read-only). Every file below is the same for everyone and is cached on your device:
  - a small status file, at most every few hours, so we can pause a scan that RSI's site changes have broken (the Daily Scan Reminder pauses with it), or pause store alerts, and show a short notice until a fix is out;
  - the public ship list (names, store prices and pictures), at most once a day, to value your ships;
  - today's exchange rates (the European Central Bank's), only if you pick a currency other than USD, at most once a day.

  Nothing is sent to us by these requests. The site is hosted on Cloudflare, which, like any website host, sees the request's IP address; we keep nothing from it except a short-lived count per address to stop abuse.

The site gathers some of this public information from community sources, such as the Star Citizen Wiki and starcitizen.tools, and credits them where it shows it. Open Hangar itself doesn't contact them.

When a scan fails, **Report a Scan Problem** opens a new GitHub issue in your browser with which parts of the scan worked and your flight log filled in (version, browser, item counts and the recent log, with no handle, Citizen Record number, referral code or item names). The report reaches GitHub in the address of the page it opens, so GitHub sees it as soon as that page loads, but nothing is posted until you post it yourself.

## Optional Sync to openhangar.space

Sync lets you see your hangar on any device. It is off until you connect, and the extension works the same without it.

- **Connecting:** press Connect to openhangar.space on the popup's Settings tab, or Connect This Browser on app.openhangar.space. Sign in on app.openhangar.space and approve the connection. The extension then keeps a sync token in its local storage. Connecting sends nothing about your hangar.
- **What is sent, and when:** once connected, the extension syncs on its own after every successful scan. Two things wait for you first: on Firefox, sync waits until you allow Firefox's data permission, and a different RSI account in this browser starts syncing only after you say yes when Open Hangar asks. You can also press Sync Now on the popup's Settings tab. Each sync sends the same data as its JSON backup file, except your referral prospects list: your hangar, buy-backs (including each one's price, insurance and what is inside it, once its page has been read), scan history (without its Store Credit or UEC), pledge archive, account identity and balances (handle, display name, the web address of your RSI portrait, UEE Citizen Record number, enlisted date, country, org (name, tag and logo address) and rank, whether you're a subscriber (with your tier and billing period, as RSI shows them), your Concierge level and how close you are to the next one, Store Credit, UEC, REC, Buy-Back Tokens, and when it was read), your referral counts, and each recruit's dates and campaign. The Citizen Record number lets the website keep the same account and history if you change your RSI handle. Your referral code is never sent, and neither is your RSI password or any RSI cookie.
- **No extra RSI requests:** sync sends what the extension already has. It never reads anything more from RSI.
- **Your old wishlist, once:** the wishlist now lives on the website. If this browser still has a wishlist from an earlier version of Open Hangar, the extension sends it to your account once each time you connect: what each item is (its name and kind, its store id if it has one, and for an upgrade, the ships it goes from and to), up to 500 items. The website adds them to your account's Wishlist and removes nothing there. The copy in this browser stays as it is. Nothing is sent if it's empty.
- **Requests while connected:** only to app.openhangar.space: to finish connecting, to sync, to disconnect, to send your old wishlist once (above), and to read your Wishlist and send the changes you make to it (see [Your Wishlist](#your-wishlist)).
- **Disconnecting:** Disconnect on the popup's Settings tab stops syncing, turns off the Daily Scan Reminder and cancels this extension's token. The copy already synced stays on the website until you delete it there; your Account page on the website can download or delete everything.
- **Inactive accounts:** if a website account has no sign-in and no sync for 24 months, the website deletes it along with all its synced data. It emails you 6 months before, and again 30 days before. Signing in or syncing resets the clock. Data in the extension itself is not affected.
- **What the website keeps and for how long:** see the website's own privacy policy, https://app.openhangar.space/privacy. The website is run by Draco Foundry, LLC and hosted on Cloudflare.

## Permissions and why they are used

- **storage:** to save your scanned data and UI preferences locally.
- **unlimitedStorage:** big hangars and buy-back lists, plus scan history and the pledge archive, can outgrow the browser's default 10 MB limit; this lifts the limit. Everything still stays on your device.
- **cookies:** for three things, all on robertsspaceindustries.com. Log Out of RSI clears RSI's cookies so you can fully end your RSI session from the extension. To guess whether you're signed in to RSI, the extension checks whether RSI's session cookie is in this browser. When it isn't there, the popup shows Log In to RSI first, with Scan still there to press. RSI sets that cookie for visitors who aren't signed in too, so only a scan tells for sure. The browser hands over the cookie when asked, but for this check the extension only looks at whether it's there, and the check doesn't contact RSI. And Add to RSI Cart works the way RSI's own upgrade window does: it reads RSI's session token cookie and sends it back to robertsspaceindustries.com with the cart request. The extension never saves a cookie's value and never sends one anywhere but RSI.
- **Host access to robertsspaceindustries.com:** to make the read-only requests described above, and to put an upgrade or the items you picked in your RSI cart when you click Add to RSI Cart or Send to RSI Cart.
- **identity:** for connecting sync. Connect, in the popup or from Connect This Browser on app.openhangar.space, opens a sign-in window, where you sign in to app.openhangar.space and approve the connection (see [Optional Sync](#optional-sync-to-openhangarspace)). The window hands the extension a one-time code to finish connecting, never your password. Nothing else uses it.
- **alarms:** for store alerts and the Daily Scan Reminder only. It wakes the extension for a store alerts check at most every 30 minutes while alerts are on (see [Store Alerts](#store-alerts)), and once a day while the reminder is on, to check the time of your last scan (see [Daily Scan Reminder](#daily-scan-reminder)). When both are off, it stops. Nothing else uses it.
- **notifications:** optional. The browser asks for it only from the Notifications switch or the Daily Scan Reminder switch on the popup's Settings tab, and you can say no: the number on the toolbar button and the popup's Wishlist tab still work, and the reminder stays off. With it, each Remind Me item newly on sale gets a notification while Notifications is on, and the Daily Scan Reminder shows its notification while it's on. Turning both switches off gives it back. Nothing else uses it.
- **offscreen** (Chrome and Edge only): lets a scan run in a hidden page instead of a tab. A scan reads RSI's pages as HTML, which Chrome and Edge allow only in a page, not in the extension's background. The hidden page reads nothing Scan didn't already read. Firefox doesn't need it.
- **Messages from openhangar.space:** pages on openhangar.space, app.openhangar.space and hangar.openhangar.space, and no other site, can check that Open Hangar is installed. Pages on openhangar.space and app.openhangar.space can ask it for three things. The first is Add to RSI Cart on the website's store: the page sees which of your ships can be upgraded and RSI's prices, inside your browser only (see [Add to RSI Cart](#add-to-rsi-cart)). The second is Send to RSI Cart on the website's store: the page sends the items in your Haul and sees which ones RSI added, inside your browser only (see [Add to RSI Cart](#add-to-rsi-cart)). The third, on app.openhangar.space only, is Connect This Browser, which connects sync from the website. hangar.openhangar.space is our hangar page, which shows your hangar without an account. It can ask for four things: your hangar as this browser scanned it, when it was last scanned, a new scan, and Add to RSI Cart. Your hangar here means your backup file without the scan history, your referral code and your referral prospects list. It never includes your sync token, the site address, your settings or your wishlist. The page shows it inside your browser only and keeps no copy after you close it. Your hangar never reaches our server. On Firefox, the page can read your hangar only after you say yes to Firefox's data prompt. Chrome and Edge let these pages message the extension directly. Firefox doesn't, so on Firefox the extension runs a small bridge script on these pages that only passes their messages to the extension and its answers back. It reads nothing else on the page and sends nothing anywhere else.

## Data export

Open Hangar lets you export your database as a JSON file (or a CSV of your pledges or buy-backs) that you choose to save. The JSON file includes your scan history and pledge archive. That file is created locally and handled entirely by you; the extension does not upload it anywhere. (Only sync sends this data, minus the referral prospects list and the Store Credit and UEC in your scan history, and only if you connected it.) Your referral code is deliberately left out of exports.

## Multiple accounts

Scanned data is tied to the RSI account it came from. Each account's data is kept separately in this browser: when you sign in to RSI with a different account, Open Hangar shows that account's last scan (or asks for a first scan), and the other account's data waits until you sign in as them again. Accounts never mix. You can see and remove saved accounts under Saved Accounts on the popup's Settings tab.

## Changes to this policy

Material changes will be noted in the project's repository and the "Last updated" date above.

## Contact

Email [support@openhangar.space](mailto:support@openhangar.space), or open an issue on GitHub: https://github.com/Draco-Foundry/open-hangar/issues

Unofficial, fan-made, and not affiliated with Cloud Imperium Games or RSI.
