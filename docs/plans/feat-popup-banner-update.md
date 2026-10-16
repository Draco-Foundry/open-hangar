# feat-popup-banner-update (#698, #664)

Goal: the popup shows what the basic page shows at its top: the status.json banner and
"Open Hangar {version} is ready." with Reload to Update. The version is already in the
popup's header.

Steps:

1. Popup.svelte reads the banner (OH.getRemoteStatus, the same cached copy main.js
   refreshes) and local updateReady, and follows their changes.
2. Both show above the tabs on every tab, in the basic page's words (copied into
   ui/popup/copy.js, checked word for word by test/popup.test.js).
3. Reload to Update reloads the extension; it waits while a scan runs.
4. Smoke test: the popup with a banner and an update ready.

Done: npm test, test:ui, format:check pass; checked in Chrome, Edge and Firefox.
