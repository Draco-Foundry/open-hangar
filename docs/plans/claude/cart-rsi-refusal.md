# Add to RSI Cart: RSI's own refusal, and signed-out first

Goal: a refused add says what RSI said, not a guess. "Cart Already Busy" only when
RSI's message is about a buy-back; a plain RSI refusal comes back as `rsiSays`
(trimmed, no account data). Signed out of RSI → `signed-out` before any request.

Steps:

1. `rsiSays(json)`: RSI's refusal text, tags and account-looking bits (emails, long
   numbers) taken out, capped.
2. `cartRefusal`: `cart-conflict` only for a buy-back mention (not any "cart").
3. `refusedBy` and the add send `rsiSays` with every refusal RSI explained.
4. No Rsi-Token cookie (cookies API answered) → `signed-out`, nothing asked of RSI.
5. Tests with invented refusal texts; background comment documents the answer.

Done: format, tests, build + store check, test:ui pass.
