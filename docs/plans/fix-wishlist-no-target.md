# fix/wishlist-no-target

Goal: the popup's Wishlist has no Target Price (#693). Ship sales are on or off, not
discounts to wait for.

Steps:

1. Remove the Target Price field, its save and its words from the popup Wishlist.
2. Update the popup smoke test and the copy test.
3. CHANGELOG bullet under Unreleased; CONNECTOR.md lines.

Done: format:check, npm test, test:ui pass; the privacy policy's target price line is
left for the next policy update (filed).
