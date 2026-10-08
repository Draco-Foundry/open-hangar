// Demo clock: the demo dashboard (npm run demo, npm run screenshots) and the UI
// smoke test (npm run test:ui) run at a fixed moment, so date-dependent fixtures
// (buy-back token dates, events, patch-note ages, "today"/"yesterday") read the
// same on every day of the year and can never break a build.
//
// Loaded before any page script: run.mjs puts it first in <head>, and smoke.mjs
// also installs it with page.evaluateOnNewDocument. The clock starts at the fixed
// instant and then moves with real elapsed time, so timers and "x seconds ago"
// still behave. Only Date.now() and a no-argument new Date() / Date() change;
// new Date(anything) and Date.parse/UTC are untouched.
//
// window.__OH_DEMO_NOW (set before this runs) picks another instant; 'real' turns
// the freeze off.
(function () {
  if (window.__ohDemoClock) return; // installed once, whoever loads it first
  const want = window.__OH_DEMO_NOW;
  if (want === 'real') return;
  const FIXED = Date.parse(want || '2026-10-01T15:00:00Z');
  if (!Number.isFinite(FIXED)) return;
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const offset = FIXED - realNow();
  const now = () => realNow() + offset;

  function DemoDate(...args) {
    if (!new.target) return new RealDate(now()).toString(); // Date() called as a function
    return args.length ? new RealDate(...args) : new RealDate(now());
  }
  DemoDate.prototype = RealDate.prototype;
  DemoDate.now = now;
  DemoDate.parse = RealDate.parse;
  DemoDate.UTC = RealDate.UTC;
  window.Date = DemoDate;
  window.__ohDemoClock = { fixed: FIXED, offset };
})();
