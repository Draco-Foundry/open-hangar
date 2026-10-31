# fix/drop-scan-reminder-hint

Goal: remove the hint line under the Daily Scan Reminder switch.

Steps: reminderLine returns null with nothing to say; Settings draws no line; drop the copy key; update tests and smoke.

Done: npm test, format:check, build:ui pass.
