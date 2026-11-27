# fix/canary-sale-price

Goal: the RSI canary's saved-copy check stops failing when a big sale puts more than half
of RSI's ships on sale (it failed Nov 16 to 27 with "store-ships.json: live now has price").

Steps:

1. In `scripts/canary.mjs`, let a saved page name fields only some rows carry (`price`,
   set only for ships on sale); those count when set in any row, not in half.
2. Run the canary locally, plus a simulated big sale, and the repo's checks.

Done: canary green locally; a live list with most ships on sale no longer trips the check;
`price` vanishing from every row still does.
