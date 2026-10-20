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
- `sources.scanHidden`: `"enabled": false` runs scans on the small Open Hangar page in a
  tab again instead of the hidden scan page (0.4.0, `src/scan-host.js`), if the hidden
  page itself breaks. It only ever turns the hidden page off. Auto Scan Daily never runs
  in a tab, so it skips its days until the hidden page is back.
- `sources.autoScan`: `"enabled": false` (or a `minVersion`) pauses Auto Scan Daily
  alone (0.4.0, #666): pressed scans go on, and each skipped day asks RSI nothing and
  shows "scans are paused" under its switch. Pausing `hangar` pauses it too;
  `buybacks` or `referrals` only skip that part of its full read.
- `banner`: a notice at the top of the basic page (the dashboard in a build without
  the connector). `level` is `warn` or `info`;
  `until` (a date) hides it automatically after that day; `maxVersion` shows it only
  on that version or older (versions before 0.3.0 ignore it and always show it).
- When the fix is out everywhere, put the file back to
  `{ "sources": {}, "banner": null }`.

A mistake in the file can't break anyone: a missing or unreadable file means "scan
as normal". Paused scans never touch RSI and never change saved data.

## 1. Spot it

Usual signs:

- A red **RSI canary** post in #ops. Every day `.github/workflows/canary.yml` runs
  the real parsers on RSI's public pages (store, ship matrix, patch notes,
  loaner help articles) and says which one broke, or that RSI couldn't be reached.
  Run it yourself any time: `npm run canary`. It can't see logged-in pages (hangar,
  buy-backs, referrals).
- A scan error like _"Signed in, but couldn't read any hangar"_ (the page still
  has pledge markers but the parser found nothing: markup changed).
- A scan that finishes but with missing fields (no dates, no values, every item
  "unknown") or far fewer items than before.
- Several bug reports in the same day (in #bug-reports on Discord or on GitHub),
  often with a pasted **Flight Log** (Send Flight Log on the problem card, or
  Developers → Copy Flight Log).

Check the flight logs first: they show the version, browser, item counts and the
exact errors, which usually tells you which source broke.

## 2. Find what broke

| Source    | Page / endpoint                                            | Parsed by                                    |
| --------- | ---------------------------------------------------------- | -------------------------------------------- |
| Hangar    | `GET /account/pledges?page=N&pagesize=…` (HTML)            | `parsePledges()` in `src/scraper/parser.js`  |
| Buy-backs | `GET /account/buy-back-pledges?page=N&pagesize=100` (HTML) | `parseBuybacks()` in `src/scraper/parser.js` |
| Account   | account dashboard's embedded JSON + public citizen dossier | `OH.getAccount()` in `src/lib.js`            |
| Referrals | `POST /graphql` (`GetReferralRecruitsList` …)              | `OH.getReferral()` in `src/lib.js`           |

Where each of them looks (addresses, selectors, cell positions, name patterns) is in
the parser rules, `src/data/parser-rules.json`; the functions above are how it's read.
Then follow **CONTRIBUTING.md → "Rediscovering the data source"** to see the new
request and markup in DevTools.

## 3. Fix it with a test

1. Save the new page (logged in, **your own** account) as HTML.
2. **Scrub it** before committing: handle, email, referral code, order numbers,
   anything personal. Keep the structure, change the text.
3. Replace or add a fixture in `test/fixtures/` (e.g. `pledges.sample.html`).
4. Run `npm test`: the parser tests should fail the same way users see.
5. Fix the rules in `src/data/parser-rules.json` (a new key also goes in
   `schema/parser-rules.schema.json`), run `npm run rules`, and add an assertion for
   whatever broke. Change the parsing code only when how a page is read changed, not
   just where.
6. `npm test`, `npm run test:ui`, then try a real scan with the unpacked build
   (`npm run build`, load `dist/chrome`).

## 4. Ship It and Tell People

The maintainer releases the fix (as a hotfix if the stores already got an update
today) and posts in Discord while the stores review it. Players open issues from the
**Scan Broken** template. The release and announcement steps are kept in the maintainer's private notes.
