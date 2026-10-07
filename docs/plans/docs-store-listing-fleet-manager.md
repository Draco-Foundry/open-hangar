# docs/store-listing-fleet-manager

Goal: the 0.3.0 store listing text for the Oct 28 submission, with no claim the build
can't back up.

Steps:

1. docs/STORE.md section 6: the new Summary and Detailed description. Every bullet and
   paragraph checked against the code on this branch; a bullet (or part) with nothing
   behind it is trimmed, never reworded.
2. `_locales/en/messages.json`: the new summary as the manifest description, counted
   against Chrome's 132 characters.
3. docs/STORE.md: drop the "local-only with no server" note and section 10 (Safari);
   later sections renumbered.
4. docs/STORE-LISTINGS.md: every translated description marked Retired for 0.3.0.
5. `_locales/<lang>`: any summary saying local-only or no server loses that claim.

Done: format check, unit tests and the build (with the store build check) pass; the PR
lists every trim with where the code was searched.
