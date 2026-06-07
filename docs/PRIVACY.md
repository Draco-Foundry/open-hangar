# Privacy Policy — Open Hangar

_Last updated: 2026-06-07_

Open Hangar is an open-source browser extension that reads your own Star Citizen /
Roberts Space Industries (RSI) account data and stores it **locally in your
browser**. This policy explains exactly what it does and does not do with data.

## The short version

- **No account, no password, no sign-up.** Open Hangar uses the RSI session you are
  already signed in with in your browser.
- **No server. Nothing is sent to us — we have no server to send it to.** Your
  scraped data never leaves your device.
- **We do not collect, sell, transfer, or share any personal data.**

## What data is accessed and where it is stored

When you click **Scan**, the extension reads **your own** RSI account by making
requests to robertsspaceindustries.com using your existing browser session, and
parses the results locally. This may include:

- Your hangar (pledges: ships, CCUs, add-ons, coupons)
- Your buy-back pledges
- Account identity and balances (handle, display name, org, rank, Store Credit,
  UEC, REC)
- Your referral code and your recruits/prospects (handles, monikers, dates)

All of this is stored **only** in your browser's local extension storage
(`chrome.storage.local`). It is never transmitted to the developer or any third
party. You can remove it at any time with **Clear Data** on the Home page, or by
uninstalling the extension (which deletes all stored data).

## Outbound network requests

The extension makes a small number of outbound requests, none of which carry your
personal data:

- **robertsspaceindustries.com** — to read your own account (above) and to load
  hangar thumbnails and the home banner image.
- **api.star-citizen.wiki** (public, read-only) — to fetch the current game version
  and ship images for items RSI ships without art. These image lookups, done by ship
  name, are cached locally and are the only outbound signal that weakly relates to
  what you are viewing; no credentials or personal data are sent.

## Permissions and why they are used

- **storage** — to save your scanned data and UI preferences locally.
- **cookies** — used solely for "Log out of RSI," which clears
  robertsspaceindustries.com cookies so you can fully end your RSI session from the
  extension. Cookie values are never read or transmitted.
- **host access** to robertsspaceindustries.com and api.star-citizen.wiki — to make
  the read-only requests described above.

## Data export

Open Hangar lets you export your database as a JSON file that you choose to save.
That file is created locally and handled entirely by you; the extension does not
upload it anywhere. (Your referral code is deliberately excluded from exports.)

## Multiple accounts

Scraped data is tied to the RSI account it was scanned from. If you open Open Hangar
while signed in to a different account, it clears the previous account's data and
prompts a fresh scan, so accounts never mix.

## Changes to this policy

Material changes will be noted in the project's repository and the "Last updated"
date above.

## Contact

Open Hangar is open source. Questions and issues:
https://github.com/Draco-Foundry/open-hangar/issues

_Unofficial, fan-made, and not affiliated with Cloud Imperium Games or RSI._
