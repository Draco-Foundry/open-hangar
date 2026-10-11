# Parser Rules: Account, Dossier, Referrals and Stores

## Goal

Second part of connector step 4, phase 1: move where `src/lib.js` reads the account
(the dashboard's JSON keys), the public dossier (Citizen Record and main organization),
and its GraphQL requests (referrals, the Subscriber Store, the store list) plus the
cart's address into the bundled parser rules. Behavior doesn't change.

## Steps

1. Rules and schema for `account`, `dossier`, `referrals`, `subStore`, `upgrade`, `cart`.
2. `src/lib.js` reads them as `RULES.<path>`; GraphQL answers are read by the
   document's own field names (a renamed field is aliased in the document).
3. The rules test covers the new groups: named groups, every rule read, no selector,
   operation name or account key of lib.js's own; each document defines its operation.
4. ARCHITECTURE.md and CONTRIBUTING.md.

## Done When

All tests pass unchanged; format, build and store check, UI test (Chrome, Edge),
Firefox lint.
