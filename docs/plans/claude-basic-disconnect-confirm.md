# Basic page: Disconnect asks first

Goal: the basic page's Disconnect asks before it disconnects, with two equal buttons
side by side, one line each, centered (#570, item 3), in the words the extension already
uses for that question.

Steps: the question in ui/basic/Settings.svelte; its styles in ui/basic/basic.css; the
UI test presses Disconnect, Stay Connected, then Disconnect.

Done: format, `npm test`, `npm run test:ui` pass; checked at 375 px.
