# feat/connector-wishlist-import

Goal: in the connector, the wishlist lives on the website; the one a 0.3.x browser kept
goes to the account once, added to what's there, and the copy here stays.

Steps:

1. ui/basic/wishlist-import.js: the items (ships by name, store items by id, each once,
   at most 500), sent once per connection to the website, retried no sooner than 6
   hours when it isn't taken.
2. The basic page calls it when it sees a connection: on open, after Connect, after a
   sync. Firefox only after its data permission.
3. docs/CONNECTOR.md lists the new request and what the privacy policy needs.
4. Tests in test/basic-page.test.js; the storage key in test/storage-budget.test.js.

Done when: tests pass; the website's side is written down for the website session.
