// Where a pop-up menu goes (menus are `position: fixed`): under its button with the
// right edges lined up, or above the button when there's no room below. Used by the
// Export menus and the top bar's menus.
export function placeUnder(btn, menu) {
  const b = btn.getBoundingClientRect();
  const h = menu?.offsetHeight || 0;
  const below = b.bottom + 6 + h <= window.innerHeight - 8;
  return {
    right: Math.max(8, window.innerWidth - b.right),
    top: below ? b.bottom + 6 : Math.max(8, b.top - 6 - h),
  };
}
