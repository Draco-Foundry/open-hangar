// Small text helpers the Org Fleet tables share.

// "Ana ×2, Ben": who owns a ship, and how many.
export const owners = (list) =>
  list.map((o) => (o.n > 1 ? `${o.name} ×${o.n}` : o.name)).join(', ');

// Part of a total as a whole percent, or a dash when there's no total.
export const share = (part, total) => (total ? Math.round((part / total) * 100) + '%' : '—');
