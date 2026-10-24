# fix/archive-lean-local

Goal: the local pledge archive keeps only what buy-back details read, as the backup
file already does: no picture URLs, no giftable or meltable, no worked-out flags.

Steps: `archiveGone` stores lean entries; storage v4 to v5 leans the live archive,
parked accounts' and the recovery copy's; tests for a migrated and an unchanged case.

Done: format check, npm test, build and check:store pass.
