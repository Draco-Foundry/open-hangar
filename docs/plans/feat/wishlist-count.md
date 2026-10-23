# feat/wishlist-count

Goal: the popup's bell and Alerts view go; the Wishlist tab shows a green count of
Remind Me items on sale, those items sort to the top, and the toolbar badge follows the
same rule.

Steps:

1. Remove the bell, the Alerts view and their words, CSS and smoke tests.
2. The Wishlist tab's count (hidden at 0, with an accessible name) and the on-sale sort.
3. The badge and notifications on the same rule; trim src/alerts.js to what they use.
4. Changelog fragment placeholder; words asked from Claude chat.

Done: format, Firefox lint, tests, build, check:store and test:ui pass.
