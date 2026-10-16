# fix-privacy-wishlist-target (#706)

Goal: the privacy policy's Wishlist "Changing it:" line names only add and remove, in
the owner's approved words, and no request can carry a target price.

Steps:

1. The approved sentence in docs/PRIVACY.md, site/privacy.html and the plain text
   (`npm run privacy:plain`), word for word.
2. ui/popup/wish-client.js: drop the unused `save` change (Target Price left the popup
   in #696), so only add and remove can be sent.
3. Tests: privacy copies equal, the Wishlist client refuses anything but add and remove.

Done: npm test, format:check pass.
