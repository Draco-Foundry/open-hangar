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

Open Hangar is a **free, open-source (MIT), non-commercial** browser extension that
lets a Star Citizen / RSI account holder read **their own** account data — hangar,
buy-backs, balances, organization, and referral standing — and view or export it
**locally**. It:

- **collects no credentials** — it uses only the RSI session the user is already
  signed into; the user never enters a password into the extension;
- **operates entirely on the user's device** — no external server receives the
  user's data; there is no backend to receive it;
- **is read-only and rate-limited** — it reads pages the user can already see, with
  a politeness delay, and does not perform bulk or automated account actions;
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

| Permission                         | Why it is needed                                                                                                                                                                                  | Scope limit                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `storage`                          | Persist the user's own scanned data + UI preferences locally (`chrome.storage.local`).                                                                                                            | Local only; never transmitted.                                                         |
| `cookies`                          | Implements "Log out of RSI" — clears `robertsspaceindustries.com` cookies (incl. the HttpOnly session cookie page scripts can't remove) so the user can end their RSI session from the extension. | Cookie **values are never read or transmitted**; only removed on explicit user action. |
| host: `robertsspaceindustries.com` | Read the signed-in user's own account pages via same-session `fetch`, parsed locally.                                                                                                             | Read-only, rate-limited, user's own account only.                                      |
| host: `api.star-citizen.wiki`      | Public, read-only API for the current game version and ship art for items RSI ships without images.                                                                                               | No credentials or personal data sent.                                                  |

**Data handling summary (for data-disclosure forms):**

- **Data collected:** only the signed-in user's own RSI account data.
- **Where it goes:** stored locally on the user's device. **No server. No
  transmission to the developer or any third party. No sale or sharing of data.**
- **Credentials:** none requested, entered, or stored. The extension relies on the
  user's pre-existing browser session.
- **Removal:** "Clear Data" wipes stored data on demand; uninstalling removes
  everything.

A full user-facing privacy policy is published in `docs/PRIVACY.md`.

---

## 4. Transparency & auditability

Open Hangar is **MIT-licensed and fully open-source**, so every claim in this
document is independently verifiable by reading the source. There is no obfuscated,
minified, or remotely-hosted code; the extension ships no remote `<script>` and
loads no remote executable code (consistent with Manifest V3 and store policy). A
reviewer can confirm the "local-only, no credentials, read-only" claims directly.

---

## 5. Precedent: an established, currently-listed category

Reading a user's **own** Star Citizen account through their existing RSI session is
a long-standing, openly-listed category on the Chrome Web Store. Representative
peers in good standing include:

- **Star Citizen CCU Game** (`efkaeodcipbmkhbbfmiagjcnnlhdkdlf`) — a companion to
  ccugame.app that reads the user's hangar and buy-backs to plan upgrade chains. Its
  own listing states it _"only runs in your browser and doesn't send any data to
  another server. You need to be logged in on robertsspaceindustries.com, you don't
  need to login in the extension itself, so your credentials stay secure."_ This is
  the same architecture Open Hangar uses, described in the same terms.

- **Star Citizen HangarXPLOR** (`hmiiohicemghafoicmmlfklnngmcinnm` and forks) —
  open-source (github.com/Dwayde/StarCitizen-HangarXPLOR), free, reads the user's
  hangar / buy-backs / logs and **exports them to CSV and JSON**. Establishes that
  open-source tooling that reads and exports one's own account data is an accepted,
  normal pattern.

- **Star Citizen Bulk XPLORer** (`bdccgdpiiagbadkjmnflkpkeogpmnpkm`) — an approved,
  listed companion that performs bulk melt/gift and, per its own listing,
  **"WILL ask for your password … but at no stage is this password ever stored, or
  sent to any non-RSI websites."**

**Why this matters for Open Hangar specifically:** even the password-handling peer
above is listed and in good standing. Open Hangar performs **no account actions and
requests no password at all** — it is strictly read-only and credential-free. It
therefore sits on the **more conservative end** of an already-permitted category,
not at its edge.

(Several additional Star Citizen account/hangar/dark-mode/link tools are likewise
listed, indicating a populated, mature category rather than a novel or fringe use.)

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
  MIT-licensed, and does not resell data or IP.
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

- Remain read-only, rate-limited, and credential-free (keep the politeness delay in
  `lib.js`; no bulk or automated account actions).
- Keep the extension local-only with no data transmission; keep the privacy policy
  accurate to behavior.
- Keep the code open-source and free of remote code execution.
- Maintain the unaffiliated disclaimer and brand guardrails in §6.
- Respond promptly to any platform or rights-holder inquiry.

---

## 8. Conclusion

Open Hangar is a transparent, local-only, credential-free, open-source tool that
reads only the user's own account data and sends it nowhere. It fits squarely within
an established and currently-listed Chrome Web Store category, while operating more
conservatively than several approved peers. We are confident it meets store policy
and respects the rights holder's published fan-use guidance, and we welcome reviewer
questions.
