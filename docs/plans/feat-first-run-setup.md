# feat/first-run-setup

Goal: the first-run setup from mockup v2, behind the `firstRun` flag (off in store and
beta builds until its words are approved): a fresh install opens the basic page at
#setup once; Welcome, What to Read (the opt-in switches, each off, with a tip) and
Before You Connect, Connect (openhangar.space and the RSI sign-in), First Scan.

Steps:

1. The `firstRun` flag; the install hook in src/background.js.
2. ui/basic/Setup.svelte with the shared switch row (tips added to OptInRow) and the
   Before You Connect card; Not Now is Local Mode.
3. Words: approved ones from the Handoffs Words row, the rest marked PLACEHOLDER.
4. Tests (install hook, switches, placeholders), storage budget, demo flag.

Done: npm test, format:check, build, check:store pass; test:ui passes; the setup page
checked in the demo with OH_DEMO_FIRST_RUN=1.
