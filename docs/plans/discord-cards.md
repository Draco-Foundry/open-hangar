# Discord Posts in the Standard (Extension)

Goal: the extension's Discord posts follow Open Hangar's Discord standard (owner, 2026-10-28):
titled cards, no emoji, the footer and Discord's timestamp on the last card.

Steps:

1. `scripts/discord-post.mjs`: a grey header card "Open Hangar {version} Is on the Way",
   `- ` lines with no closing full stop, every card titled, footer
   "Extension {version} · Fly safe, Citizens. o7" and the timestamp.
2. `scripts/notify.mjs`: titled cards, one color meaning, long text cut with the run link,
   pinned to the website's copy by `test/fixtures/discord-notify-cases.json`.
3. `ci.yml` (the commit's first line only), `canary.yml`, `publish.yml` pass titles.

Done: format check, web-ext lint, `npm test`, build. Nothing posted to Discord.
