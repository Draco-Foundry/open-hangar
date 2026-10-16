# feat-popup-alerts-scroll (#699)

Goal: past three alerts, the bell's list scrolls in a fixed height, and each row is
more compact.

Steps:

1. Alerts.svelte: New and Earlier sit in one scroll box; past three it gets a fixed
   height, a visible scroll bar and a tab stop (arrow keys scroll it).
2. Rows: the name and the why on one line each, cut with an ellipsis (the whole text on
   hover and for screen readers).
3. Smoke test with 0, 1, 3 and 10 alerts.

Done: npm test, test:ui, format:check pass; Chrome, Edge and Firefox.
