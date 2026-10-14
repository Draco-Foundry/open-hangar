# Store Doc Matches the Chrome Privacy Practices Tab

## Goal

`docs/STORE.md` says what the Chrome Web Store dashboard's Privacy practices tab now
says (filled in 2026-10-14 so 0.3.x can be submitted): the single purpose, every
permission's justification (with `identity`, new in 0.3.0), no remote code, and the
data usage now that opt-in sync exists.

## Steps

1. §4 Privacy & Compliance: the checklist done, the data usage as declared.
2. §5 Permission Justifications and §6 single purpose: the dashboard's words.

## Done

- `npm run format:check` passes; the texts match the dashboard.
