/*
 * Rotating lines for moments people see over and over (#256): one is picked at
 * random each time, never the same one twice in a row. Signed off by the owner
 * 2026-10-01; the review copy is docs/JOKE-POOLS.md (keep them in sync, and the
 * website's copy in open-hangar-server app/src/lib/quips.ts).
 * Errors, warnings, buttons, numbers and legal text never rotate.
 */
(function () {
  const OH = (window.OH = window.OH || {});

  OH.QUIPS = {
    scan: [
      'Spooling quantum drive…',
      'Calling the ASOP terminal…',
      'Asking RSI nicely…',
      'Dodging a 30k…',
      'Counting your JPEGs…',
      'Waking up the hangar crew…',
      'Polishing the Carrack…',
      'Checking under the Polaris…',
      'Untangling your CCU chains…',
      'Reading the fine print on your LTI…',
      'Waiting for the hangar doors to open…',
      'Pinging the Comm-Link relay…',
      'Tallying up the warbonds…',
      'Sweeping the cargo bay…',
      'Holding the elevator…',
      'Defrosting the microTech data…',
      'Dusting off your concept ships…',
      'Taking inventory, the physicalized way…',
      'Fueling up at the R&R…',
      'Running the numbers, not the Idris…',
    ],
    loading: [
      'Loading…',
      'Waiting on the elevator…',
      'Quantum fuel at 2%…',
      'Spinning up the reactor…',
      'Retrieving your ship from the hangar…',
      'Request queued at the ASOP terminal…',
      'Calibrating the mobiGlas…',
      'One moment, the tram is late…',
      'Clearing customs at Area18…',
      'Calculating jump coordinates…',
      'Loading, faster than a server restart…',
      'Hold tight, Citizen…',
    ],
    emptyHangar: [
      'Your hangar’s empty. Not even a starter ship.',
      'Echoes in here. Your hangar’s waiting for its first ships.',
      'Nothing on the pads yet.',
      'Empty hangar, full potential.',
      'The hangar’s spotless. Suspiciously spotless.',
      'Your landing pads are lonely.',
      'No ships, no problems. Also no fun.',
      'The ASOP terminal’s got nothing to show you yet.',
      'Hangar status: freshly swept, zero ships.',
      'Even a Pisces would feel spacious in here.',
      'Not a single JPEG in sight.',
      'Your fleet is currently theoretical.',
    ],
    caughtUp: [
      'Comms are quiet.',
      'All caught up. o7',
      'Nothing new on the scanner.',
      'Quiet skies, Citizen.',
      'No transmissions. Enjoy the silence.',
      'Radar’s clear.',
      'All quiet in the ’verse.',
      'Nothing to report. The hangar crew is on break.',
      'No new pings. Go fly something.',
      'Inbox zero, space edition.',
    ],
    scanDone: [
      'Landed.',
      'Hangar logged, every pad checked.',
      'Scan complete. Every ship accounted for.',
      'Touchdown. Clean landing.',
      'All ships present and polished.',
      'Inventory done, no 30k required.',
      'Scanned and stamped.',
      'Your fleet checks out.',
      'Done, and faster than a Lorville elevator.',
      'Hangar refreshed. o7',
      'Clean scan, Citizen.',
      'Docked and done.',
    ],
    signedOut: [
      'Hangar doors closed. Fly safe.',
      'o7, see you in the ’verse.',
      'Signed out. Your ships stay parked.',
      'Logged off. Mind the elevators on your way out.',
      'See you next patch.',
      'Safe travels, Citizen.',
      'Hangar locked up tight.',
      'Off you go. Don’t forget your helmet.',
      'Signed out. The hangar crew will keep the lights on.',
      'Clear skies, Citizen.',
    ],
  };

  // A random line from a pool, never the one this pool gave last time.
  const last = {};
  OH.quip = function quip(pool, rand = Math.random) {
    const list = OH.QUIPS[pool];
    if (!list || !list.length) return '';
    if (list.length === 1) return list[0];
    let i = Math.floor(rand() * list.length);
    if (i === last[pool]) i = (i + 1) % list.length;
    last[pool] = i;
    return list[i];
  };
})();
