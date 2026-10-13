# words/connector-batch-1

## Goal

Put the owner-approved words (2026-10-13) in place of the `[copy: ...]` placeholders on
the connector screens: the popup, the basic page, Extension Alerts and Add to RSI Cart.

## Steps

1. `ui/popup/copy.js`, `ui/basic/copy.js`, `src/alerts.js` COPY: each key's approved
   words, word for word, every `{placeholder}` kept. Header comments updated.
2. The basic page's counts: "1 pledge" / "1 buy-back" when n is 1 (a `.one` key t()
   picks), for the scan report rows, the saved account line and the buy-backs total.
3. `ui/details/RsiCart.svelte`: the six cart strings.
4. Tests and the UI smoke checks read the real words instead of placeholders.

## Done

- No `[copy:` left in the four files.
- `npm run format:check`, `npm test`, `npm run test:ui` pass.
