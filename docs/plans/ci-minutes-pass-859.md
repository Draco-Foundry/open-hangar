# ci-minutes-pass-859

Goal: spend fewer Actions minutes (server #859, extension half). Delete before merge.

Steps: timeout-minutes on every job; npm cache in CI; actionlint becomes a step of
`test` instead of its own job (a short job bills a whole minute); notify needs only `test`.

Done: actionlint passes on the changed workflows; `test` still reports.
