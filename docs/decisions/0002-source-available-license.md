# 0002: Source Available Under PolyForm Strict

- **Date:** 2026-09-30
- **Sources:** commit 46314f1 (PR #162), the "License and Repo" section of the website
  plan (commit cef0ac8), `LICENSE`, `THIRD_PARTY_NOTICES.md`

## Context

Open Hangar was released under the MIT License up to 0.2.11. The owner is the only
author and the repo had no forks.

## Decision

From 0.2.12, Open Hangar is source available under the PolyForm Strict License 1.0.0.
The code stays public so anyone can read and audit it, but it may not be redistributed
or published in changed versions. The recorded reason (commit 46314f1): the owner
doesn't want copies or competing versions.

## Consequences

- Releases before 0.2.12 stay available under MIT (`LICENSE` header).
- Third-party code keeps its own license: `THIRD_PARTY_NOTICES.md` covers HangarXPLOR
  (MIT) and hangarlink-hangarexport. `scripts/pack.mjs` ships `LICENSE` and the notices
  in every build.
- "Open source" became "source available" across the extension, site, README, privacy
  policy, compliance doc and store listings; `package.json` uses the SPDX id
  `PolyForm-Strict-1.0.0`.
- The relicense also said unsolicited pull requests weren't accepted. That was reversed
  on 2026-10-01 (commit 6d5f568, #266): CONTRIBUTING.md now welcomes pull requests.
