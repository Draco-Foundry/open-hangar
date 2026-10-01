# When RSI changes their site

RSI has no public API, so Open Hangar reads the same pages you see. When RSI
redesigns something, part of a scan can break overnight. This is the playbook for
getting a fix out fast.

## 0. Pause the broken scan (minutes, no release)

Edit `site/status.json` on `main`; the Pages workflow publishes it to
`https://openhangar.space/status.json`. Extensions read it at most every 6 hours, so
most users see it within a few hours.

```json
{
  "sources": {
    "hangar": {
      "enabled": false,
      "message": "RSI changed their hangar page. Scans are paused while a fix is on the way. Your saved data is safe."
    }
  },
  "banner": {
    "message": "RSI changed their site, hangar scans are paused. A fix is coming.",
    "level": "warn",
    "until": "2026-10-08"
  }
}
```

- `sources`: `hangar`, `buybacks` or `referrals`. `"enabled": false` pauses it;
  `"minVersion": "0.2.13"` pauses it only on older versions (use this once the fix
  is out, so people on the fix keep scanning). `message` is optional (300 characters,
  plain text).
- `banner`: a notice across the top of the dashboard. `level` is `warn` or `info`;
  `until` (a date) hides it automatically after that day.
- When the fix is out everywhere, put the file back to
  `{ "sources": {}, "banner": null }`.

A mistake in the file can't break anyone: a missing or unreadable file means "scan
as normal". Paused scans never touch RSI and never change saved data.

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
3. Run **Actions → Publish to stores** with that tag and `store: all`, then
   Approve the `stores` environment when the run asks. It uploads to Firefox, Edge
   and Chrome and posts to Discord #updates. If Chrome is still reviewing the last
   version, rerun later with `store: chrome`. Small fixes for a change on RSI's side
   usually clear review quickly.
4. Post in Discord #status: what broke, that a fix is in review, and that people
   can load it from source (README → Install) if they can't wait.

## 5. Tell people while you work

Open an issue from the **Outage Notice** template, pin it, and link it in Discord
#status ("RSI changed their hangar page; scans are broken, a fix is on the way") so
the same report doesn't come in 30 times. People who file anyway use the **Scan
Broken** template, which points them at the open `scan-broken` issues first. Your data isn't
lost: a failed or partial scan never overwrites a bigger earlier one.
