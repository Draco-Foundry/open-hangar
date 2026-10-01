# When RSI changes their site

RSI has no public API, so Open Hangar reads the same pages you see. When RSI
redesigns something, part of a scan can break overnight. This is the playbook for
getting a fix out fast.

## 1. Spot it

Usual signs:

- A red **RSI canary** post in #ops. Every day `.github/workflows/canary.yml` runs
  the real parsers on RSI's public pages (store, ship matrix, Comm-Links, patch notes,
  loaner help articles) and says which one broke, or that RSI couldn't be reached.
  Run it yourself any time: `npm run canary`. It can't see logged-in pages (hangar,
  buy-backs, referrals).
- A scan error like _"Signed in, but couldn't read any hangar"_ (the page still
  has pledge markers but the parser found nothing: markup changed).
- A scan that finishes but with missing fields (no dates, no values, every item
  "unknown") or far fewer items than before.
- Several bug reports in the same day, often with a pasted **error report**
  (Developers → Copy error report).

Check the error reports first: they show the version, browser, item counts and the
exact errors, which usually tells you which source broke.

## 2. Find what broke

| Source    | Page / endpoint                                            | Parsed by                                    |
| --------- | ---------------------------------------------------------- | -------------------------------------------- |
| Hangar    | `GET /account/pledges?page=N&pagesize=…` (HTML)            | `parsePledges()` in `src/scraper/parser.js`  |
| Buy-backs | `GET /account/buy-back-pledges?page=N&pagesize=100` (HTML) | `parseBuybacks()` in `src/scraper/parser.js` |
| Account   | account dashboard's embedded JSON + public citizen dossier | `OH.getAccount()` in `src/lib.js`            |
| Referrals | `POST /graphql` (`GetReferralRecruitsList` …)              | `OH.getReferral()` in `src/lib.js`           |

Then follow **CONTRIBUTING.md → "Rediscovering the data source"** to see the new
request and markup in DevTools.

## 3. Fix it with a test

1. Save the new page (logged in, **your own** account) as HTML.
2. **Scrub it** before committing: handle, email, referral code, order numbers,
   anything personal. Keep the structure, change the text.
3. Replace or add a fixture in `test/fixtures/` (e.g. `pledges.sample.html`).
4. Run `npm test`: the parser tests should fail the same way users see.
5. Update the selectors/parsing, and add an assertion for whatever broke.
6. `npm test`, `npm run test:ui`, then try a real scan with the unpacked build
   (`npm run build`, load `dist/chrome`).

## 4. Ship it fast

1. Patch version bump in `manifest.json` and `package.json` (e.g. 0.2.8 → 0.2.9),
   and a CHANGELOG entry ("Fixed: scans after RSI's … change").
2. Merge, then tag: `git tag v0.2.9 && git push origin v0.2.9`. The Release
   workflow builds the zips and publishes the GitHub Release.
3. Upload `open-hangar-chrome-*.zip` to Chrome and Edge, and
   `open-hangar-firefox-*.zip` to Firefox. In the review notes, say it's a fix for
   a site change on RSI's side; small fixes usually clear quickly.
4. Post in Discord #announcements: what broke, that a fix is in review, and that
   people can load it from source (README → Install) if they can't wait.

## 5. Tell people while you work

Pin a short message in #help ("RSI changed their hangar page; scans are broken, a
fix is on the way") so the same report doesn't come in 30 times. Your data isn't
lost: a failed or partial scan never overwrites a bigger earlier one.
