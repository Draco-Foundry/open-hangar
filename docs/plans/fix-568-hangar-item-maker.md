# fix-568-hangar-item-maker

Goal: a hangar scan reads RSI's maker line from each item tile that shows one (#568).

Steps:

1. Parser rule `hangar.itemMaker` (`.liner`) and its schema entry; the parser keeps
   the line as RSI wrote it, as an item's optional `manufacturer`.
2. The sync schema's item gets the optional field, with a conformance vector.
3. PARSER_VERSION bump; a corpus test cross-checks every tile.

Done: format, tests and the store build check pass.
