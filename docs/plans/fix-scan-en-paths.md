# Scan Asks for /en/ Addresses Directly

## Goal

RSI answers `/account/pledges`, `/account/buy-back-pledges` and `/pledge/buyback/<id>`
with a 301 to the same address under `/en/` (its only language: `/de/` and `/fr/`
redirect there too). Ask for the `/en/` address, so every page a Scan reads is one
request instead of two (#661).

## Steps

1. The three paths in `src/data/parser-rules.json`; regenerate with `npm run rules`.
2. The parser-rules test's expected addresses; a CHANGELOG line.

## Done

- `npm run format:check`, `npm test`, `npm run build` and `npm run check:store` pass.
- The signed-out check still works (it reads the page and where a redirect lands, not
  whether one happened).
