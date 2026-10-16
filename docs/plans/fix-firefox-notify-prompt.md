# fix-firefox-notify-prompt (#694)

Goal: on Firefox, turning on Notifications in the popup no longer leaves the popup over
Firefox's permission prompt.

Steps:

1. In `askNotify` (ui/popup/actions.js), on Firefox, close the popup once the request has
   gone out. Firefox shows a popup's prompt on the selected tab and applies the grant in
   the parent process, so the answer survives the popup closing.
2. Settings reads the switch from the permission when it opens again (already so).

Done: the ask still is the click's first step; Chrome and Edge unchanged; checked in
Firefox.
