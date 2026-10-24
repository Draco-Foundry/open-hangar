# Clear Data removes buy-back page details

Goal: Clear Data leaves no `bbDetails` or `bbdMisses`.

Steps:

1. Remove both keys in Clear Data, dropping any save still waiting.
2. A test that no buy-back detail key is left.

Done: format, lint, `npm test`, build and check:store pass.
