# fix/popup-notice-styles

Goal: the popup's Update Ready notice and status banner are styled again. #708 was squashed
from a stale base and removed #704's `.pp-notice` rules and its smoke check.

Steps:

1. Put back `.pp-notice` and `.pp-notice.warn` in ui/popup/popup.css.
2. Put back the `notices` check in scripts/screenshots/smoke.mjs, plus a styled-card check.
3. Check the rest of #708's diff for other lost rules (Settings is #732's).

Done: format:check, npm test, npm run test:ui pass; popup at 360 px in Chrome, Edge and Firefox,
light and dark. Plan file removed before merge.
