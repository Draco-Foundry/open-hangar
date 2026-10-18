# docs-agent-rules

Goal: Working Rules for Agents and Rules Without a Test in CLAUDE.md, and a deny list in
`.claude/settings.json` (the agent rules brief of 2026-10-18).

Steps: add the CLAUDE.md sections, add `.claude/settings.json` and unignore it, check it
parses and `format:check` passes, open a draft PR listing each deny pattern.

Done: valid JSON, format and tests pass, PR lists every pattern with a reason.
