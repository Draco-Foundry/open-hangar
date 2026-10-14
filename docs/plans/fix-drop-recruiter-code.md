# fix-drop-recruiter-code

**Goal:** the extension stops keeping the referral code of the player who recruited you
(RSI's `referrerReferralCode`, cached as `account.referral.referrerCode`). Nothing uses
it. The player's own referral code and link stay exactly as they are.

**Steps:**

1. `src/lib.js` extractReferral: return `{ code, url }` only; the cached account's
   version goes up (shape change).
2. Parser rules: drop `account.referral.referrerCode` from `src/data/parser-rules.json`
   and `schema/parser-rules.schema.json`, then `npm run rules`.
3. On the update, clear a saved copy: `account.referral.referrerCode` in local storage
   (a few lines in the background worker's update handler, the only code that runs on
   an update). Parked profiles and the recovery slot hold the database only, no
   `account`.
4. Tests: a recruiter code in `test/stored-data.js`; a dashboard with
   `referrerReferralCode` no longer gives it; an old cached account loses it on the
   update; it's in none of the sync body, the backup or the hangar view; bridge v2's
   FORBIDDEN list gets the raw key names. Guard tests updated where they pin pairs.

**Done when:** `npm run format:check`, `npm test`, `npm run build` then
`npm run check:store`, and `npm run lint:firefox` pass; PR open, not merged.
