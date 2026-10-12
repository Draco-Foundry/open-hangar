# Pledge Item Kinds

Goal: the hangar parser handles a contained item tagged "Upgrade" and items with no kind (listed under "Also Contains") without dropping items or marking a pledge or scan incomplete; a fixture for each item kind.

Steps: check parser.js and scanShape; add test/fixtures/pledge-item-kinds.html and tests.

Done: npm test passes.
