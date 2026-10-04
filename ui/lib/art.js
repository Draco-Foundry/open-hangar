// Missing ship art for the card lists (Inventory, Buy-Backs): looked up only for
// cards on (or near) the screen, three at a time, so a 1,000-card page doesn't look
// up a thousand pictures nobody scrolled to. The answers are cached by lib.js
// (OH.getShipImage), so each name is asked about once.
const MAX_AT_ONCE = 3;
const queue = [];
let active = 0;
let observer = null;
const waiting = new Map(); // watched node → its job

function pump() {
  while (active < MAX_AT_ONCE && queue.length) {
    const job = queue.shift();
    if (job.cancelled) continue; // its card was redrawn away while waiting
    active++;
    Promise.resolve()
      .then(job.run)
      .catch(() => {})
      .finally(() => {
        active--;
        pump();
      });
  }
}

// Run `run` (a lookup) once `node` comes within 800px of the screen. Returns a
// function that cancels it (the card went away).
export function whenNear(node, run) {
  const job = { run, cancelled: false };
  if (typeof IntersectionObserver === 'undefined') {
    queue.push(job);
    pump();
    return () => (job.cancelled = true);
  }
  observer ||= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);
        const j = waiting.get(e.target);
        waiting.delete(e.target);
        if (j) queue.push(j);
      }
      pump();
    },
    { rootMargin: '800px 0px' }, // start a little before a card scrolls into view
  );
  waiting.set(node, job);
  observer.observe(node);
  return () => {
    job.cancelled = true;
    if (waiting.delete(node)) observer.unobserve(node);
  };
}
