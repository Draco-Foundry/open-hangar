# feat/new-opt-in-card

Goal: behind the `firstRun` flag, the popup (1) offers the first-run setup again until
it's finished or skipped, and (2) after an update shows an opt-in that release added,
once, with Turn On or Not Now.

Steps:

1. ui/lib/opt-ins.js: the opt-ins, their words and the release each arrived in;
   newOptIns() picks what to ask after an update.
2. ui/popup/NewOptIn.svelte and the popup's wiring; setupOpened from the install hook.
3. Words: W18, W21, W22 approved; Finish Setup a placeholder.
4. Tests, storage budget.

Done: npm test, format:check, build, check:store pass; test:ui passes.
