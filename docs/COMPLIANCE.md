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

| Permission                         | Why it is needed                                                                                                                                                                                                                                                    | Scope limit                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `storage`                          | Persist the user's own scanned data + UI preferences locally (`chrome.storage.local`).                                                                                                                                                                              | Local only; never transmitted.                                                         |
| `cookies`                          | Implements "Log out of RSI" — clears `robertsspaceindustries.com` cookies (incl. the HttpOnly session cookie page scripts can't remove) so the user can end their RSI session from the extension.                                                                   | Cookie **values are never read or transmitted**; only removed on explicit user action. |
| host: `robertsspaceindustries.com` | Read the signed-in user's own account pages — hangar, buy-backs, balances, and the referrals GraphQL endpoint (a read-only `POST` query) — via same-session `fetch`, parsed locally; also RSI's public ship-matrix index for art on items RSI ships without images. | Read-only, rate-limited, user's own account only.                                      |
| host: `api.star-citizen.wiki`      | Public, read-only **fallback** API for the current game version and for ship art when RSI's ship-matrix has no image.                                                                                                                                               | No credentials or personal data sent.                                                  |

**Data handling summary (for data-disclosure forms):**

- **Data collected:** only the signed-in user's own RSI account data. (The referral
  section of that account lists the user's own recruits/prospects — other citizens'
  public handles, monikers, and dates — which are likewise stored locally only and
  never transmitted.)
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
a long-standing, openly-listed category on the Chrome Web Store. A survey of
currently-listed peers in this space (June 2026) shows a **populated, mature
category with well over 125,000 combined installs** — not a novel or fringe use:

| Extension (publisher)                               | Users  | Rating    | Data handling                      | Source |
| --------------------------------------------------- | ------ | --------- | ---------------------------------- | ------ |
| Star Citizen CCU Game (ccugame.app)                 | 70,000 | 4.6 (45)  | Local; optional cloud sync         | —      |
| Hangar Link Connect (hangar.link / T. Humphrey)     | 30,000 | 4.7 (13)  | → sends pledge data to hangar.link | —      |
| Star Citizen Hangar XPLORer (Peter Dolkens)         | 20,000 | 4.7 (128) | Local; file export                 | GitHub |
| Citizens' Hub (citizenshub.app)                     | 3,000  | 5.0 (3)   | → sends to citizenshub.app         | —      |
| Star Citizen Hangar XPLORer — Dwayde's mod (Dwayde) | 649    | 4.7 (3)   | Local; file export (CSV/JSON/HTF)  | GitHub |
| Guildswarm Hangar Manager (GuildSwarm)              | 436    | 5.0 (7)   | Local; downloads JSON, no login    | GitHub |
| StarCitizen Hangar helper (ShinOby)                 | 333    | 5.0 (5)   | Local; file export + melt          | —      |
| Star Citizen Bulk XPLORer — Dwayde's mod (Dwayde)   | 166    | 5.0 (2)   | Acts on RSI; **asks password**     | GitHub |
| Star Citizen Hangar XPLORer — CE (AlyxOne)          | 163    | 5.0 (2)   | Local only                         | —      |
| Star Citizen — LinkBox (1337encore)                 | 119    | 5.0 (2)   | Local dashboard / link launcher    | —      |
| SCTool Ship Exporter (starcitizentool.com)          | 66     | no rating | Local; JSON export                 | —      |
| Star Citizen Hangar Sync (hubcitizen.com)           | 60     | no rating | → sends to hubcitizen.com          | —      |
| Guardians Hub Sync (shadowguardians.cloud)          | 57     | no rating | → sends to OrgCommand              | —      |
| RWX Ship Viewer (Roger Wolff)                       | 22     | 5.0 (3)   | Local; read-only ship-spec viewer  | —      |
| AG Passport (aerostar.group)                        | 12     | no rating | → sends to Aerostar Group          | —      |
| SC Bridge Sync (scbridge.app)                       | 12     | no rating | → sends to scbridge.app            | —      |
| SC Labs Hangar Importer                             | 10     | 5.0 (5)   | Local scrape; manual JSON import   | —      |
| VoidLog.GG (voidlog.gg)                             | 8      | no rating | → sends to voidlog.gg              | —      |
| VerseSync RSI Pledge Sync (versesync.com)           | 6      | 5.0 (1)   | → sends to versesync.com           | —      |
| starplace.net                                       | 4      | no rating | → sends to starplace.net           | —      |
| Outreach RSI Sync (JobsQC)                          | 3      | no rating | → sends to Outreach Syndicate      | GitHub |
| VerseLink RSI Hangar Sync                           | 2      | no rating | → sends to VerseLink               | —      |
| ATLAS Hangar Sync (crxc.space)                      | n/a    | no rating | → sends to ATLAS                   | —      |
| FleetBooks RSI Sync (smoothandbumpy)                | n/a    | no rating | → sends to FleetBooks              | —      |

_Install counts and ratings as displayed on each extension's Chrome Web Store
listing, June 2026. "n/a" = the listing is live but shows no install count. The
70,000 / 30,000 / 20,000-user leaders alone account for ~120,000 of the combined
total, confirming this is a high-traffic, well-trodden category._

**Where Open Hangar sits in this category.** Two patterns dominate the roster above:

1. **Local-only tools** that read the user's hangar and keep the data on the device
   (optionally exporting a file the user downloads) — e.g. the HangarXPLOR family,
   StarCitizen Hangar helper, SCTool Ship Exporter, Guildswarm, SC Labs Importer.
2. **Sync tools** that read the hangar and **transmit it to the developer's own web
   service** — hangar.link, Citizens' Hub, hubcitizen.com, OrgCommand, scbridge.app,
   versesync.com, FleetBooks, and others.

Open Hangar belongs to the **first, more conservative pattern** — and is stricter
still: it has no companion web app and no backend, so the user's data is **never
transmitted anywhere** (§1, §3). The many approved "sync" peers that _do_ send
hangar data to a remote server demonstrate that even the more data-exposing pattern
is accepted; Open Hangar deliberately stays on the local-only side of that line.

**Credential handling — Open Hangar is on the strict end.** Almost every peer is
credential-free (it relies on the existing RSI session), and several explicitly
advertise that they "never require your RSI password." The one notable exception is
**Star Citizen Bulk XPLORer** (`bdccgdpiiagbadkjmnflkpkeogpmnpkm`), an approved,
listed tool that performs bulk melt/gift and, per its own listing, **"WILL ask for
your password … but at no stage is this password ever stored, or sent to any non-RSI
websites."** Open Hangar performs **no account actions and requests no password at
all** — it is strictly read-only and credential-free.

**The category's accepted data-handling envelope (per peers' own disclosures).**
Chrome's data-disclosure form requires each developer to declare the categories of
user data the extension handles. The declarations below are taken **verbatim from
the listed peers' own Chrome Web Store data disclosures** — they are not our
characterization. They show that the category, as currently approved, accommodates
data handling far broader than anything Open Hangar does:

| Extension                 | Self-declared data handling (per its own CWS disclosure)                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| FleetBooks RSI Sync       | Personally identifiable information; **Financial and payment information**; Website content                      |
| VerseSync RSI Pledge Sync | Personally identifiable information; **Authentication information**; User activity                               |
| SC Bridge Sync            | Personally identifiable information; **Authentication information**; Website content                             |
| VerseLink RSI Hangar Sync | **Authentication information**; Website content                                                                  |
| starplace.net             | **Web history**; Website content                                                                                 |
| Star Citizen CCU Game     | Personally identifiable information; Website content                                                             |
| Star Citizen — LinkBox    | Personally identifiable information; Website content                                                             |
| Citizens' Hub             | Website content                                                                                                  |
| **Open Hangar**           | **None transmitted** — local-only; no PII, authentication, financial, or web-history data ever leaves the device |

Several of these — **SC Bridge Sync** and **VerseLink** declare handling
**Authentication information**; **FleetBooks** declares handling **Financial and
payment information** — are nonetheless **listed and in good standing**. Open Hangar
declares none of these categories because it transmits nothing. (For balance, a
number of peers — the HangarXPLOR family, StarCitizen Hangar helper, SCTool Ship
Exporter, SC Labs Importer, Guardians Hub Sync, ATLAS — instead declare _"will not
collect or use your data,"_ the same posture Open Hangar takes.)

Open Hangar's local-only claim is not merely a declaration: with no web platform and
no backend (§3, §4), there is nowhere for data to be sent, and a reviewer can confirm
this directly in the open source.

**Representative flagship precedents** (the highest-install, most directly
comparable peers):

- **Star Citizen CCU Game** (`efkaeodcipbmkhbbfmiagjcnnlhdkdlf`) — 70,000 users,
  4.6★ (45 ratings). A companion to ccugame.app that reads the user's hangar and
  buy-backs to plan upgrade chains. Its own listing states it _"only runs in your
  browser and doesn't send any data to another server. You need to be logged in on
  robertsspaceindustries.com, you don't need to login in the extension itself, so
  your credentials stay secure."_ This is the same architecture Open Hangar uses,
  described in the same terms.

- **Star Citizen Hangar XPLORer** (`hmiiohicemghafoicmmlfklnngmcinnm`, plus the
  Dwayde's-mod and Community-Edition forks) — 20,000 users, 4.7★ (128 ratings) on
  the original (Peter Dolkens), open-source
  (github.com/dolkensp/HangarXPLOR). Free, reads the user's hangar / buy-backs / logs
  and **exports them to CSV, JSON, and the Hangar Transfer Format**. Establishes that
  open-source tooling that reads and exports one's own account data — including the
  same export format Open Hangar targets — is an accepted, normal pattern.

- **Star Citizen Bulk XPLORer** (`bdccgdpiiagbadkjmnflkpkeogpmnpkm`) — 166 users,
  5.0★ (2 ratings). The password-handling, action-taking peer described above:
  listed and in good standing despite being materially more invasive than Open
  Hangar.

**Why this matters for Open Hangar specifically:** the category is established,
populated, and currently listed; its tools span from local-only readers, to
server-syncing uploaders, to a password-prompting bulk-action tool — and all are
accepted. Open Hangar is read-only, credential-free, and local-only, with no backend
and no account actions. It therefore sits on the **most conservative end** of an
already-permitted category, not at its edge.

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
