# fix/site-connect-breakpoint

Goal: the Connect card never covers the Citizen Card's name and org lines (#542).

Steps: Connect stacks under the card's text up to 1000px; beside it, the name and org
lines stop short of it. Measure 375 to 1280px in Chrome, Edge and Firefox.

Done: no overlap at any width, no word alone on the org line.
