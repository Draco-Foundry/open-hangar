# fix/587-buyback-token-refresh

Goal: the buy-back token count on Home and the Buy-Backs header follows a scan
or an import without a reload (#587).

Steps:

1. One helper reads the count from a stored buy-back source (same rule as at load).
2. After a buy-back scan, re-read the saved source and set the count.
3. The import path sets it too.
4. Smoke test: a scan that saves `meta.tokens` changes the shown count.

Done: format:check, npm test, npm run test:ui pass; PR "Fixes #587".
