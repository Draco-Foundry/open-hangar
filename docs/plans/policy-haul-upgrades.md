# policy-haul-upgrades

Goal: the extension privacy policy says Send to RSI Cart also sends ship upgrades in the
Haul, one at a time through RSI's upgrade store, with the owner's approved words.

Steps:

1. docs/PRIVACY.md: the Send to RSI Cart paragraph, the second request under Messages from
   openhangar.space, and the cookies bullet's cart sentence; Last updated to the merge day.
2. `npm run privacy:plain` for the plain and AMO copies.
3. site/privacy.html: the same three lines and date.

Done: the four copies match, `npm run format:check` and `npm test` pass.
