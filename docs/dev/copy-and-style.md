# Copy and Style

## Look

- **One look only: Clean Pro.** No theme picker or alternative looks. Light mode comes
  later as a twin of the same look.
- **Weights:** buttons 500; prices, names and headings 600 at most; only tiny all-caps
  tags may use 700. Never heavier.
- **No orphans:** no heading or caption ends with one word alone on its last line
  (`text-wrap: balance` on headings, `pretty` on body text); no `·` starting a line.
- Pages with no signed-off spec in docs/REDESIGN-0.3.md keep the content and behavior
  they have today: no new design without the owner's OK (mockups get signed off first).

## Words

- **Title Case** for every heading and every link and button label ("Load Details",
  "Lost Your Keycard?"). Body sentences stay sentence case.
- **No emojis** anywhere in the UI. A simple drawn (SVG) icon when one is truly needed;
  the ✕ close button is fine.
- **No em dashes (—)** in user-facing text. Use periods, commas or parentheses.
- **Voice:** short and professional, with light Star Citizen flavour (docs/VOICE.md),
  always positive, never implying something was broken. The action must stay obvious;
  add a small muted hint after a joke label when needed. Legal and privacy text stays
  plain.
- **Don't name other community tools or sites** in public text, except required data
  and license credits (#448).

## What Not to Build

- From 0.3.0 the extension gets reading improvements and fixes only; new features go on
  the website.
- No rankings or leaderboards of pilots or orgs.
- No gear score: never compare totals, values or counts between players. Org Fleet
  shows ships, never values.
- No paid tiers: no subscriptions, premium tier or paid features.
- No Safari build, and no API for other sites to read the extension's data.
- No LTI counts or LTI emphasis in summaries, no CCU-chain features, no "best use of
  your buy-back token" advice, no duplicates card, no insight cards (pages go straight
  to their search bar).
- No "First Time Ever" badge, and never call something new or rare from missing
  records. Store availability wording is about how often RSI sells it (Always
  Available, Sold Often, Sold Sometimes, Sold Rarely, Hardly Ever Sold, Events Only),
  never Epic/Legendary/Mythic.
