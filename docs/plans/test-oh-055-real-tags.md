# test/oh-055-real-tags

Goal: check the October 2026 hangar changes (the ATTRIBUTED tag, Game Access and
gift-marked pledges) against the real scrubbed hangar pages in `test/fixtures/corpus/`,
not only the made-up fixtures from #715. Closes the parts of #713 a capture can answer.

Steps:

1. Read where ATTRIBUTED sits in the real pages and what the parser reads around it.
2. Make `test/fixtures/pledge-tags.html` use the real ATTRIBUTED markup.
3. Tests over the real pages: every card's tag, the same parse with the tags taken
   out, giftable and meltable equal to the Gift and Exchange actions, a complete scan.
4. Fix the parser only if one of these fails (and bump the parser version if #725's
   check applies).

Done: `npm run format:check` and `npm test` pass; what a capture still can't answer is
left on #713.
