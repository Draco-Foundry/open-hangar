# feat/account-logs

Goal: read RSI's pledge log and store credit log (Account) behind the `accountLogs` build
flag (default off, developer builds only), and send them with sync as
`sources.pledgeLog` and `sources.creditLog`, with no handle or email ever leaving the
parser.

## Steps

1. Parser rules for both logs (paths, selectors, time, event and credit patterns).
2. `parsePledgeLog` and `parseCreditLog` in `src/scraper/parser.js`, only named groups out.
3. The reader in `src/lib.js`: full history on request (paced, resumable, kept when
   whole), the day's read after (stops at a known line), each log's pause switch.
4. The scan runs it; Clear Data and an account switch drop it; export shapes it.
5. The sync schema and the field list; test vectors for the website's pin.
6. The popup's Account History row: its off switch (stops and removes the logs) and Load Full History, with the words approved 2026-11-01.

## Done

`npm run format:check`, `npm test`, `npm run build` + `npm run check:store`, the flag off in
store builds, both builds load clean in Chrome, Edge and Firefox.
