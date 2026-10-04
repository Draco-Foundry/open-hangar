// Big card lists draw the first screenful at once and the rest a chunk at a time in
// the background, so a page of 1,000 buy-backs responds at once. `n` is how many
// cards to draw now; update() restarts the count whenever the list itself changes
// (a new filter, sort or scan), not when the same list just redraws.
import { untrack } from 'svelte';

const FIRST_CARDS = 120;
const CARD_CHUNK = 200;

export class Progressive {
  n = $state(FIRST_CARDS);
  #sig = null;
  #total = 0;
  #timer = 0;

  // `sig` names the list (its ids in order), `total` is its length.
  update(sig, total) {
    untrack(() => {
      this.#total = total;
      if (sig === this.#sig) return;
      this.#sig = sig;
      clearTimeout(this.#timer);
      this.n = FIRST_CARDS;
      this.#next();
    });
  }

  #next() {
    if (this.n >= this.#total) return;
    this.#timer = setTimeout(() => {
      this.n += CARD_CHUNK;
      this.#next();
    }, 0);
  }

  stop() {
    clearTimeout(this.#timer);
  }
}

// The list's signature for update(): its ids, in order.
export const idsOf = (list) => list.map((x) => x.id).join('\n');

// Keys for a keyed {#each}: the id, made unique if a list holds one twice.
export function keyed(list, limit = Infinity) {
  const seen = new Map();
  return list.slice(0, limit).map((item) => {
    const id = String(item.id ?? '');
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    return { k: n > 1 ? `${id}#${n}` : id, item };
  });
}
