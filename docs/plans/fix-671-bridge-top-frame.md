# fix-671-bridge-top-frame

Goal: the website bridge answers only our production pages in store builds, from the
top frame only, in every browser (#671).

Steps:

1. Chrome and Edge: answer a page's message only from its tab's top frame, as Firefox
   already does.
2. Tests: the store and beta builds' host list is exactly our production pages; the
   test helper's copy of the list agrees with scripts/site-pages.mjs; the Firefox
   build's bridge matches are pinned like Chrome's externally_connectable.

Done: format, tests and the store build check pass.
