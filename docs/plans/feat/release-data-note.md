# Release Data Note

Goal: from 0.5.6 on, every release's notes end with one approved line saying where a
pilot's data lives, in CHANGELOG.md and in the GitHub release.

Steps:

1. `scripts/changelog-fragments.mjs`: the line (`DATA_NOTE`) and `withDataNote`.
2. `scripts/release.mjs`: the new version's section ends with it.
3. `release.yml`: it stays the last line, after Install.
4. `scripts/discord-post.mjs`: the Discord post leaves it out.
5. Tests.

Done when: `npm test` passes, prettier is clean, a dry run of the notes step ends with it.
