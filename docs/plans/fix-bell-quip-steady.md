# Bell's caught-up line stays put during a scan (#586)

Goal: the Alerts menu's "all caught up" line no longer changes on every alerts refresh.

Steps:
1. ui/topbar/Bell.svelte: pick the line when the menu opens, not each time the list re-derives.
2. scripts/screenshots/smoke.mjs: the line stays the same across several 'oh:alerts'
   events while open, and still varies between separate opens.

Done: format:check, test, test:ui pass; PR into redesign/0.3-svelte with "Fixes #586".
