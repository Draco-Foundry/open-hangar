# feat/connector-build

Goal: a build with the connector on holds only the popup, the basic page and what they
load, and its pages can only reach RSI, openhangar.space and the sync site.

Steps:

1. scripts/connector.mjs: what a connector build keeps (following the two pages'
   imports), trimming the rest, and the check both ways.
2. pack.mjs trims connector builds and adds `connect-src`; check-store-build.mjs runs the
   check on every folder and zip.
3. docs/CONNECTOR.md: what stays, the gated removal plan, the outbound requests that go
   (for the owner to OK). Permissions: none to drop, said why.
4. Tests: test/connector-build.test.js (real builds in a scratch copy).

Done when: tests, store check, Firefox lint pass; the trimmed build works in Chrome,
Edge and Firefox, offline too, and requests to other hosts are refused.
