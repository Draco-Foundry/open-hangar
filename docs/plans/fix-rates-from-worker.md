# fix/rates-from-worker

Goal: openhangar.space/rates.json stays fresh without a Pages run.

Steps:

1. Share the rates parsers and check between scripts/update-rates.mjs and site-worker.
2. site-worker serves /rates.json (ECB, two stand-ins, edge cache ~6 h, static fallback).
3. Tests for the parsers, check and fallback rule.
4. Canary: reword the stale-rates line, keep the 5-day limit.

Done: format, tests, build, store check and a local wrangler bundle pass.
