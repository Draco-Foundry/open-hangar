# Connect tells accounts apart by id (#765)

Goal: the switch question compares the website's account id, not the display name.

Steps:

1. Keep `account` from /api/link/token and /api/link/poll answers in `siteLink`.
2. `OH.siteSwitches` compares ids when both links have one, else names as before.
3. Tests; flag the website change (it must send the id).

Done: format, lint, `npm test`, build and check:store pass.
