# Permission Pin Test

Goal: a test fails if any store or beta manifest (Chrome/Edge, Firefox) gains a permission, optional permission, host permission, content script match or externally_connectable entry beyond what docs/PRIVACY.md lists today; the allowed list in one place.

Steps: test/permission-pin.test.js building real store and beta manifests in a scratch copy; register it in npm test.

Done: npm test passes.
