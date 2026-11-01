# Open Hangar — Compliance & Risk Statement

**Document purpose.** This statement addresses the compliance posture of the Open
Hangar browser extension for the parties most likely to evaluate it: a **Chrome Web
Store reviewer**, a **store/platform policy or trust-and-safety team**, **Cloud
Imperium Games (CIG/RSI)** rights holders, and **prospective contributors**. It is
written to let a reviewer answer the question "is this safe and policy-compliant?"
from the document itself.

It is an internal good-faith compliance summary, not legal advice.

---

## 1. Executive summary

Open Hangar is a **free, source-available, non-commercial** browser extension that
lets a Star Citizen / RSI account holder read **their own** account data — hangar,
buy-backs, balances, organization, and referral standing — and view or export it
**locally**. It:

- **collects no credentials** — it uses only the RSI session the user is already
  signed into; the user never enters a password into the extension;
- **keeps the user's data on their device by default**: nothing is sent to any server
  unless the user opts in to sync by connecting their own openhangar.space account;
  once connected, it syncs to that account after each scan;
- **is read-only and rate-limited** — it reads pages the user can already see, with
  a politeness delay, and never changes anything on the account by itself. The only reading it does on its own is Auto Scan Daily, which the user turns on: once a day, for the account last scanned in that browser, and it stops if RSI asks it to slow down. The one
  exception to read-only is Add to RSI Cart (and Send to RSI Cart on openhangar.space's
  store), which puts what the user picked in their RSI cart when they click it and
  never checks out;
- **accesses only the signed-in user's own account** — never third parties.

This places Open Hangar within a **well-established, currently-listed category** of
Star Citizen account tools on the Chrome Web Store (see §5), and in fact on the
**more conservative end** of that category, since some approved peers request the
user's password and Open Hangar deliberately does not.

---

## 2. Single purpose

> Open Hangar reads the signed-in user's own Star Citizen / RSI account data and
> organizes it into a clean, local, browsable database they can also export.

Every permission and host the extension requests maps directly to this single
purpose (§3).

---

## 3. Permissions & data handling (for the store reviewer)

| Permission                         | Why it is needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Scope limit                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `storage`                          | Persist the user's own scanned data + UI preferences locally (`chrome.storage.local`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Local; sent only to the user's own openhangar.space account, if they connect sync.                                          |
| `unlimitedStorage`                 | Big hangars and buy-back lists, plus scan history and the pledge archive, can outgrow the browser's default 10 MB local quota; this lifts it.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Local; only the size cap changes.                                                                                           |
| `cookies`                          | Four things, all on `robertsspaceindustries.com`: "Log Out of RSI" clears RSI's cookies (incl. the HttpOnly session cookie page scripts can't remove); the popup checks only whether RSI's sign-in cookie exists, without contacting RSI; Add to RSI Cart, like RSI's own upgrade window, reads RSI's session token cookie and sends it back to RSI with the cart request the user asked for; reading the user's own account history (RSI's pledge log and store credit log) when they ask, as RSI's own Account pages do, it sends RSI's session token cookie back to RSI with each page request.   | Cookie values are never stored and never sent anywhere except RSI.                                                          |
| `identity`                         | Only for the optional Connect to openhangar.space: a sign-in window (OAuth with PKCE) for app.openhangar.space, which hands the extension a one-time code, never the user's password.                                                                                                                                                                                                                                                                                                                                                                                                                | Never reads the user's Google or Chrome account.                                                                            |
| `alarms`                           | Only for two optional features, both off until the user turns them on: store alerts (a check at most every 30 minutes). Auto Scan Daily (only while connected to openhangar.space): the alarm wakes the extension once a day, at a random time, to scan the user's own RSI account, the same as pressing Scan except buy-backs' own pages. It first checks which RSI account is signed in, and reads nothing more if the user is signed out or it isn't the account last scanned in this browser. It starts with a quick check and runs a full scan only when something is new or a week has passed. | Turning a feature off clears its alarm.                                                                                     |
| `notifications` (optional)         | Asked only when the user turns on Notifications or Auto Scan Daily: a notification when a Remind Me item on the user's Wishlist goes on sale and, with Auto Scan Daily on, a notice at most once a day when its scan couldn't run (signed out of RSI, or a different RSI account signed in).                                                                                                                                                                                                                                                                                                         | The user can decline (Auto Scan Daily still scans, without its notice); matching happens on the device and nothing is sent. |
| `offscreen` (Chrome and Edge)      | Runs the scan in a hidden page instead of a tab: parsing RSI's HTML needs `DOMParser`, which the service worker doesn't have (reason `DOM_PARSER`).                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Reads nothing beyond what the user's Scan already reads.                                                                    |
| host: `robertsspaceindustries.com` | Read the signed-in user's own account pages — hangar, buy-backs, balances, the referrals GraphQL endpoint (a read-only `POST` query), the account history (RSI's pledge log and store credit log, read-only `POST` page requests), and the store items RSI shows only to subscribers and Concierge members (read-only GraphQL `POST` queries) — via same-session `fetch`, parsed locally; and, on the user's click, Add to RSI Cart.                                                                                                                                                                 | Read-only apart from Add to RSI Cart; rate-limited; user's own account only.                                                |

**Data handling summary (for data-disclosure forms):**

- **Data collected:** only the signed-in user's own RSI account data. (The referral
  section of that account lists the user's own recruits and prospects. The extension
  keeps only how many there are and each one's dates (and a recruit's referral
  campaign), never their handles, names or pictures. These are stored locally; each
  recruit's dates and campaign are sent only to the user's own openhangar.space account
  if they connect sync, and the prospects list is never sent.)
- **Where it goes:** stored locally on the user's device. **Nothing is sent to any
  server unless the user opts in to sync** by connecting their own openhangar.space account; once
  connected, the extension syncs after each scan, sending the same data as the JSON
  export to that account only. Disconnect stops it. **No transmission to any third
  party. No sale or sharing of data.**
- **Credentials:** none requested, entered, or stored. The extension relies on the
  user's pre-existing browser session.
- **Removal:** "Clear Data" wipes stored data on demand; uninstalling removes
  everything in the browser. A synced copy can be downloaded or deleted from the
  user's Account page on the website.

A full user-facing privacy policy is published in `docs/PRIVACY.md`.

---

## 4. Transparency & auditability

Open Hangar's **source code is public** (PolyForm Strict), so every claim in this
document is independently verifiable by reading the source. There is no obfuscated,
minified, or remotely-hosted code; the extension ships no remote `<script>` and
loads no remote executable code (consistent with Manifest V3 and store policy). A
reviewer can confirm the "local unless the user connects sync, no credentials,
read-only apart from Add to RSI Cart" claims directly.

---

## 5. Precedent

The survey of comparable listed extensions is kept in the maintainer's private notes. Reviewers can ask for it.
edge.

---

## 6. Intellectual-property posture (CIG/RSI)

Open Hangar is an **unofficial, fan-made** tool, not affiliated with or endorsed by
Cloud Imperium Games or Roberts Space Industries. It aligns with CIG's published
stance on fan activity:

- CIG's
  [Fandom FAQ](https://support.robertsspaceindustries.com/hc/en-us/articles/115013196127-Fandom-FAQ-Videos-writing-and-more)
  and
  [Fankit & Fandom FAQ](https://support.robertsspaceindustries.com/hc/en-us/articles/360006895793-Star-Citizen-Fankit-and-Fandom-FAQ)
  permit **personal, non-commercial** fan use of their IP. Open Hangar is free,
  source available, and does not resell data or IP.
- CIG explicitly cautions users **never to give their RSI login to third-party
  tools.** Open Hangar requests **no credentials**, so it is consistent with — not
  contrary to — that guidance.

**Brand-use guardrails (followed):**

- The product is named **"Open Hangar"** — CIG trademarks are not used in the
  product name; "Star Citizen / RSI" appears only descriptively (nominative use) to
  state what the tool works with.
- Promotional imagery uses the project's own artwork, not CIG logos or screenshots.
- The "unofficial / not affiliated" disclaimer appears in the store listing, README,
  and privacy policy.
- The project will respond promptly to any rights-holder request.

---

## 7. Ongoing compliance commitments

- Remain rate-limited and credential-free, and read-only apart from Add to RSI Cart
  when the user clicks it (keep the politeness delay in `lib.js`; no bulk or automatic changes to the account; reading on its own only through Auto Scan Daily, opt-in and once a day; never check out).
- Keep the extension local by default: nothing is sent to any server unless the user
  connects sync, and sync sends only to the user's own openhangar.space account; keep
  the privacy policy accurate to behavior.
- Keep the code public (source available) and free of remote code execution.
- Maintain the unaffiliated disclaimer and brand guardrails in §6.
- Respond promptly to any platform or rights-holder inquiry.
