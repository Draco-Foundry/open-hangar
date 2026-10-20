# Saved RSI Pages

Real hangar (`/account/pledges`) and buy-back (`/account/buy-back-pledges`) pages, the
corpus `test/parser-corpus.test.js` runs the parser over. Each one is a maintainer's own
page saved from the browser, then scrubbed:

    npm run scrub -- "<saved page>.htm" test/fixtures/corpus/hangar-page-4.html --handle <your RSI handle>

The scrub keeps only the pledge list, its pager and the buy-back token line. Ids, prices,
dates, images, links, upgrade data and ship names become placeholders, emails become
`[email]` and each `--handle` becomes `PILOT_HANDLE` (scripts/scrub-capture.mjs says
exactly what). Never commit a page that hasn't been through it: this repo is public.

Names follow `hangar-page-<n>.html` and `buybacks-page-<n>.html`, where `<n>` is the page
RSI showed (the cross-checks read it). Keep the raw saved pages in `captures/`
(gitignored). To also check the fixtures for your handle, list it in
`captures/handles.txt`, one per line, or in `OH_PRIVATE_HANDLES`.

When RSI changes a page, save it again and scrub it here. If `npm run report:parser`
finds anything it doesn't recognize, add the fixture and a rule
(`src/data/parser-rules.json`, then `npm run rules`), never a skip.
