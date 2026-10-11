# fix/link-code-confirm

Goal: the website's Connect code page can ask this extension whether a code is the one
it's waiting for, so it fills in only the extension's own code; Connect stays one click.

Steps:

1. The dashboard keeps the code it's waiting for in session storage while it waits.
2. A Connect message, `oh-link-check { code }` → `{ ok, mine }`, on the app's pages only.
3. Tests: background (Chrome, Edge, Firefox bridge), bridge lists, the UI smoke test.

Done: format, npm test, test:ui, build and store check, Firefox lint; this file deleted
before merge.
