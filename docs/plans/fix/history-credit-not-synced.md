# fix/history-credit-not-synced

Goal: sync sends each scan history snapshot as its time and pledges only. Store Credit
(`credit`) stays in the browser because the popup's value change reads it; `checkedAt`
isn't read anywhere, so it isn't kept either.

Steps: `syncPayload` in `src/hangar-shape.js`; stop writing `checkedAt`; drop stored
ones on load; schema notes; tests and the sync golden hashes.

Done: format check, npm test, build and check:store pass; the website re-pin is named.
