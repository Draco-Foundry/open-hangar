# fix/uec-pledges-not-dollars

Goal: a pledge priced in in-game UEC never counts as US dollars in any money total.

Steps:

1. Parser: UEC and aUEC values get currency 'UEC' (any case); PARSER_VERSION bump.
2. One helper, `OH.usdValue(p)`, used by every money sum (totalValue, hangarValue,
   accountValue, the popup's new-since total, Spending, the melt planner, the CCU
   panel, the basic rows' totals).
3. History snapshots keep a non-USD currency as a 4th item field; melt, diff and
   snapshot value skip it. Old snapshots unchanged.
4. Per-row display: UEC shows as a UEC count, never with "$".
5. Tests: value vector (USD + UEC), parser cards (UEC, aUEC), small UI-module tests.

Done: format, npm test, build, check:store, lint:firefox pass; draft PR open.
