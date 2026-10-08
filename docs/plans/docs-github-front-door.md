# docs/github-front-door

## Goal

The GitHub front page lays out the project: what Open Hangar is, where it's headed, the
dated road to the November 10, 2026 launch, and what has shipped so far.

## Steps

1. Rewrite README.md: install steps first, direction, a dated Road to Launch with live
   milestone badges, After Launch, Recently Shipped, today's features, privacy, developer
   notes.
2. Rewrite ROADMAP.md: the full dated plan, every feature linked to its issue, Not
   Planned with reasons, and a dated Shipped log.
3. Fold in the README and ROADMAP fixes from #465 so this PR supersedes them.
4. `npm run format:check`, no em or en dashes, every placeholder filled.

## Done Means

- Both files pass Prettier and every issue and milestone link resolves.
- The PR is open and ready for the owner to preview, not merged.
