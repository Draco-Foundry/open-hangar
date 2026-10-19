# fix-safe-html

Goal: one safe way to put text on the page. Text read from RSI goes in as text; markup
goes through one shared sanitizer, `setHTML` in `src/safe-html.js`, and a test fails any
other way of inserting HTML.

Steps:

1. List every HTML insertion point (innerHTML, outerHTML, insertAdjacentHTML,
   document.write, Svelte `{@html}` and the like).
2. Move the dashboard's sanitizer into `src/safe-html.js`; route the Svelte icons through
   a `use:safeHTML` action; turn the one `innerHTML = ''` into `replaceChildren()`.
3. `test/html-insertion.test.js` (the check) and `test/hostile-text.test.js` (hostile
   pledge and item names).
4. One rule line in CLAUDE.md.

Done: npm test, format:check, build + check:store, lint:firefox and test:ui pass; CI green.
