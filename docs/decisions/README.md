# Decisions

Short records of the big decisions behind Open Hangar: the context, what was decided,
and what follows from it. Each one cites where the decision is recorded (commits,
docs, code). Where no reason was ever written down, the record says so instead of
guessing.

For how the code fits together, see [ARCHITECTURE.md](../../ARCHITECTURE.md).

| #                                        | Decision                                     | Date       |
| ---------------------------------------- | -------------------------------------------- | ---------- |
| [0001](0001-local-first.md)              | Local-first, no server for scan data         | 2026-06-01 |
| [0002](0002-source-available-license.md) | Source available under PolyForm Strict       | 2026-09-30 |
| [0003](0003-repo-split.md)               | Website services in a private repo           | 2026-09-30 |
| [0004](0004-account-value.md)            | What Account Value counts                    | 2026-09-30 |
| [0005](0005-no-self-hosted-images.md)    | Images load from their source, not re-hosted | 2026-06-01 |

## Adding One

Copy an existing file, take the next number, and keep it to about 10 to 25 lines:
Context, Decision, Consequences. Date it from the commit or doc where the decision was
made, and add it to the table above.
