# Buy-Back Details in the Sync (#798)

Goal: a synced buy-back carries its own RSI page's price, insurance and contents.

Steps:

1. The scan reads up to 30 buy-backs' own pages not read from RSI yet, before its sync.
2. The backup file and sync merge each page read into its buy-back (`price`,
   `priceFrom`, `insurance`, `contents`).
3. Schema, generated script and test vectors updated.
4. Measure requests and time for a large list.

Done: tests, build, store check and UI smoke pass; Load Details unchanged.
