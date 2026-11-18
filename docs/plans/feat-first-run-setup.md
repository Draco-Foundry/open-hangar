# feat/first-run-setup

Goal: the first-run setup from mockup v4 (owner, 2026-11-17), behind the `firstRun` flag
(off in store and beta builds until its words are approved): a fresh install opens the
basic page at #setup once; Welcome, Share (what we send and never send; I Agree or
Decline, no Skip), Settings (the opt-in switches, each off, an ⓘ pop-up each), Scan,
Cleared for Launch.

Steps:

1. The `firstRun` flag; the install hook in src/background.js.
2. ui/basic/Setup.svelte with the shared switch row and the shared ⓘ (ui/lib/InfoTip.svelte);
   Decline is Local Mode.
3. Words: approved ones from the Handoffs Words row, the rest marked PLACEHOLDER.
4. Tests (install hook, switches, I Agree before Connect, placeholders), storage budget,
   demo flag.

Done: npm test, format:check, build, check:store pass; test:ui passes; the setup page
checked in the demo with OH_DEMO_FIRST_RUN=1.
