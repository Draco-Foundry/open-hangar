# claude/concierge-store-read

Goal: the subStore read also brings the pledge store items RSI marks for Concierge members
(isVip), for a signed-in account with a Concierge level, and every kept item gets a kind and
a Concierge mark (#418, owner's option C, 2026-10-31).

Steps:

1. Parser rule `conciergeStore`: the store categories, page sizes and a page budget.
2. `getSubStore` reads both parts once a day; refusals stop the read.
3. Sync item keys `kind` and `concierge`; schema, vectors 67 to 69, tests.

Done: format, tests, build and store check pass; flag stays devOnly; matching website PR.
