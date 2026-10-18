# Open Hangar Beta

The 0.3.0 beta ships as its own **unlisted** item, **Open Hangar Beta**: a store item on
Chrome and Edge, and on Firefox a signed add-on that the website hands out
(self-distributed from addons.mozilla.org, "On your own"). It is separate from the public
Open Hangar everywhere, so it never updates the public item and testers can tell the two
apart.

Timeline: submit **Oct 13**, wave 1 tests **Oct 20 to 27**, go/no-go Oct 27, launch
**Nov 10** (launch checklist: issue #344).

## How the Beta Build Differs

| Item            | Public Open Hangar (`npm run pack`)                                       | Open Hangar Beta (`npm run build:beta`)                       |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Name            | Open Hangar (from `_locales`)                                             | Open Hangar Beta                                              |
| Icon            | blue (`icons/`)                                                           | amber, with a BETA tag at 48 and 128 px (`beta/icons/`)       |
| Version         | `manifest.json`, e.g. 0.2.17                                              | `beta/beta.json`: `0.3.0.1`, shown as "0.3.0 Beta 1"          |
| Sync            | on, built in to production `app.openhangar.space`                         | the same                                                      |
| Staging site    | nowhere: the build check fails if it shows up                             | the same                                                      |
| Permissions     | storage, unlimitedStorage, cookies, `identity` (Connect's sign-in window) | the same                                                      |
| Browsers        | Chrome, Edge, Firefox                                                     | Chrome and Edge (one zip), Firefox (its own zip)              |
| Firefox add-on  | `open-hangar@draco-foundry`, listed on AMO                                | `open-hangar-beta@draco-foundry`, unlisted (self-distributed) |
| Firefox data    | optional: what sync sends, asked on the first Connect                     | the same                                                      |
| Firefox updates | from AMO                                                                  | from `app.openhangar.space/beta/firefox-updates.json`         |

Chrome and Edge only take dotted numbers as a version, so the beta counts `0.3.0.1`,
`0.3.0.2`, ... and `version_name` carries the readable "0.3.0 Beta N". Firefox takes the
same four numbers and shows `0.3.0.1` itself.

## Build It

```sh
npm run build:beta
```

Builds two packages (today's version in the names):

- `dist/beta/` and **`dist/open-hangar-beta-0.3.0.1.zip`**: the same zip goes to Chrome
  and Edge.
- `dist/beta-firefox/` and **`dist/open-hangar-beta-firefox-0.3.0.1.zip`**: for AMO.

It then runs `node scripts/check-store-build.mjs --beta`, which fails unless both have the
beta name, icons and version, sync built in to production only, and no staging site
anywhere; the Firefox one also needs the beta's add-on id, its `update_url` and the
optional data collection sync asks for. Then `npx web-ext lint --self-hosted --source-dir
dist/beta-firefox` (or `npm run lint:firefox-beta`) runs Firefox's store linter: 0
errors. `--self-hosted` because a listed add-on may not have an `update_url`; without it
the linter reports that as an error. Its warnings are the same `innerHTML` ones as the
public build's, from the Svelte runtime (`docs/AMO-SOURCE.md`). CI runs both on every PR.
The public check is `npm run check:store`; it holds the public build to the same sync rules
(docs/FLAGS.md).

Build it from `redesign/0.3-svelte` (later `main`). Never upload this zip to the public
items, and never run the **Publish to stores** workflow for it: that workflow only knows
the public items.

Icons: edit `beta/icons/icon.svg`, then `node scripts/beta-icons.mjs` redraws the PNGs and
`beta/logo-300.png` (Edge's store logo).

## Submitting

The owner's steps for submitting to the three stores are kept in the maintainer's private notes.

### Firefox Updates File

Self-distributed copies check the manifest's `update_url`,
`https://app.openhangar.space/beta/firefox-updates.json`, for new versions. The website
serves it (as `application/json`, over https) next to the signed `.xpi`, in Firefox's
updates.json format:

```json
{
  "addons": {
    "open-hangar-beta@draco-foundry": {
      "updates": [
        {
          "version": "0.3.0.1",
          "update_link": "https://app.openhangar.space/beta/open-hangar-beta-firefox-0.3.0.1.xpi"
        }
      ]
    }
  }
}
```

Each new beta adds an entry (the newest version wins); `update_link` must point at the
AMO-signed `.xpi` of that version, over https (the path above is only an example).
Firefox checks about once a day.

## Listing Text

**Summary** (from the zip's manifest, 132 characters max):

> Beta build of Open Hangar for invited testers: your Star Citizen hangar, made useful,
> with opt-in sync to openhangar.space.

**Description:**

> Open Hangar Beta is the test flight of Open Hangar 0.3.0, for invited pilots in our
> beta program. If you weren't invited, grab the public Open Hangar instead.
>
> What's new in 0.3.0:
> • A rebuilt dashboard: Home, Inventory, Buy-Backs, Stats, Store, Org Fleet and
> Referrals
> • Optional sync to your own openhangar.space account, so your hangar is there on any
> device
> • Add to RSI Cart for ship upgrades, with RSI's own prices
>
> Everything else works like Open Hangar: it reads your own RSI account in your browser,
> using the session you're already signed in with. No password. Sync is off until you
> press Connect and sign in to openhangar.space.
>
> Please turn off the public Open Hangar while you test this one, and report bugs in
> #beta-reports on our Discord.
>
> Unofficial and fan-made. Not affiliated with Cloud Imperium Games or RSI.

**Single purpose** (from `docs/STORE.md`, plus sync):

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export, and, only
> if they connect an account, sync to their own openhangar.space account.

**Permission justifications** (from `docs/STORE.md`, with sync):

- **storage:** Stores the user's scanned hangar, buy-back and referral data and UI
  preferences locally in the browser (`chrome.storage.local`). Nothing is sent to a
  server unless the user connects an openhangar.space account.
- **unlimitedStorage:** Large hangars plus their scan history can exceed the default
  10 MB local storage quota, which would make scans fail. This only lifts the local
  size cap.
- **cookies:** Used solely to implement "Log out of RSI": clears
  robertsspaceindustries.com cookies (including the HttpOnly session cookie that page
  scripts can't remove) so the user can fully end their RSI session from the extension.
  The extension never reads cookie values or sends them anywhere.
- **identity:** Opens the browser's sign-in window (`launchWebAuthFlow`) when the user
  presses Connect, so they can sign in to their own openhangar.space account and approve
  this browser. It reads no browser or Google account data.
- **Host permission `https://robertsspaceindustries.com/*`:** The extension reads the
  signed-in user's own RSI account (hangar, buy-backs, balances, referrals) with
  same-session requests to RSI and parses them locally. Read-only and rate-limited; only
  the user's own account is accessed.

**Data usage** (only sent when the user connects and syncs):

- ☑ Personally identifiable information (RSI handle and org)
- ☑ Financial and payment information (store credit balances and pledge prices)
- ☑ Website content (hangar and buy-back contents)
- ☑ The three certifications: not sold or transferred to third parties, not used for
  anything unrelated to the item's core function, not used for creditworthiness or
  lending.

**Reviewer notes** (Edge certification notes; Chrome only asks if they email):

> Beta build of Open Hangar (public listing: Open Hangar) for invited testers. To try it,
> sign in at robertsspaceindustries.com, click the extension's icon and press Scan.
> Sync is optional: Connect needs an openhangar.space account, which is invite-only
> during the beta, and the extension works fully without it.
