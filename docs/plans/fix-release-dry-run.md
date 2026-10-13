# fix/release-dry-run

Goal: `npm run release <v> --dry-run` stays a dry run, and the pre-push format check skips `.claude/` worktrees, so the owner can cut 0.3.0.

Steps: read npm_config_dry_run / npm_config_hotfix in scripts/release.mjs; add .claude to .prettierignore; verify a dry run changes nothing.

Done: CI green, plan deleted.
