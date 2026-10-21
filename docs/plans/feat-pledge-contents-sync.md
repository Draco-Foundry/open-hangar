# feat/pledge-contents-sync

Goal: sync what's inside each pack (owner's decision, 2026-10-20): each buy-back pack's
ships, Also Contains items and price, and an `also` mark on each hangar pledge item RSI
lists under Also Contains. Sync format 3. Pairs with a website PR in the private repo,
which takes formats 2 and 3 and shows them behind a flag.

Steps:

1. Parser: `RULES.hangar.itemAlso`, `also: true` on tiles inside it.
2. Payload: `OHShape.packOf` / `withPacks`, from pack pages RSI showed (not history).
3. Schema: format 3 (`schemaVersion` 2 or 3), `pack`, `packShip`, `content.also`;
   vectors 46 to 49, 09 now format 4.
4. Tests: parser corpus, pack shaping, export bytes held except the format number.

Done: npm test, format check, Firefox lint, build and check:store pass; both builds load
clean. Merges after the queued release ships, and after the website's PR is on production.
