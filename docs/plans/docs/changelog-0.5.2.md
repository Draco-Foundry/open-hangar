# 0.5.2 Changelog Lines

Goal: the CHANGELOG lines for 0.5.2 (#747, #748) under `## Unreleased`, word for word
from Claude chat (Notion Handoffs row "EXT 0.5.2: Changelog Lines for #747 and #748").

Steps:

1. Placeholders under `## Unreleased` until the words arrive.
2. Replace them with Claude chat's lines exactly; nothing for #745 (scanBar off) or #749
   (dashboard only), and a #746 privacy line only if Claude chat sends one.
3. `npm run format:check`, `npm test`; `npm run release 0.5.2 --dry-run` counts the lines.

Done: no placeholders left, the dry run passes, this plan deleted. No version bump here:
`npm run release 0.5.2` bumps manifest.json and package.json and moves the section itself.
