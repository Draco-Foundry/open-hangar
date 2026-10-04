// Panel searches: "Search 221 ships…" placeholders and a live "12 of 221" while typing.
const n = (x) => x.toLocaleString('en-US');
export function searchMeta(q, shown, total, noun) {
  return {
    placeholder: `Search ${n(total)} ${noun}${total === 1 ? '' : 's'}…`,
    count: q.trim() ? `${n(shown)} of ${n(total)}` : '',
  };
}
