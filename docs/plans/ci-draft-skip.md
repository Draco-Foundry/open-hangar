# CI: skip draft PRs

Goal: stop running the full check on draft PRs (it runs once when marked ready).

Steps: `ci.yml` gets `ready_for_review`, a draft-skipped job name, and a draft-aware concurrency group.

Done: a draft shows "test (draft, not checked)"; a ready PR still reports "test".
