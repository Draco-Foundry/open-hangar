# fix/scan-2: A Pledge Card Without Its Id Is a Page Change

Goal: issue #914 finding 2. A hangar page with more pledge names than ids, or a buy-back
page with more cards than read, is a page change: the approved hold words, the last scan
kept, instead of a silent drop (page 2 on) or a false count mismatch (page 1).

Steps: failing tests (the saved hangar pages with a card's id removed on page 1 and on
page 3; the page change check over every saved page), then the counts in `pageChanged`.

Done: `npm run format:check`, `npm test`, `npm run build`, `npm run check:store` pass.
