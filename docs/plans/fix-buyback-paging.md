# fix-buyback-paging

Goal: hangar and buy-back scans read every item exactly once whatever page size RSI serves.

Steps:

1. Read RSI's pager (current page, next-page link, last page) in `src/scraper/parser.js`,
   selectors in `src/data/parser-rules.json` (`paging`).
2. `scanHtmlSource` (src/lib.js): stop when the pager says there is no next page, or RSI
   served a different page than asked (past the end); keep the old stops as a fallback.
3. Tests: buy-back pages at 10, 25, 50 and 100 per page; 0 items, one full page, one full
   page plus 1, several pages ending full. Each item exactly once.

Done: `npm test`, `npm run format:check` pass; PR says how page size works on RSI.
