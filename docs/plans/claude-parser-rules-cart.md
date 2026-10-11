# Parser Rules: Add to RSI Cart

## Goal

Last part of connector step 4, phase 1: move where `src/rsi-cart.js` sends its requests
and what it asks (the tool's and cart's paths, the GraphQL operations, documents and
fixed variables, the session cookie and the two token headers, the csrf token's tag,
the context body's keys, the buy-back mode, and RSI's signed-out and refusal words)
into the bundled parser rules, after step 5's cart fixes. Behavior doesn't change.

## Steps

1. Rules and schema: `upgrade` (ships, app, filter, price, add, signedOut,
   buybackMode) and `cart` (paths, cookie, headers, csrf, context, refusal).
2. `src/rsi-cart.js` reads them; the background worker imports the rules before it,
   and Firefox's event page lists them before it (`scripts/pack.mjs`).
3. The rules test reads rsi-cart.js too; the build tests list the worker's new scripts.

## Done When

All tests pass (the cart tests unchanged); the worker loads the rules and the cart in
Chrome, Edge and Firefox; format, build and store check, UI test, Firefox lint.
