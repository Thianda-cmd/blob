// Where the keys take the keyboard in a menu's list, for the app's menus (Menu.tsx) and the
// right-click menus (ContextMenu.tsx). In a module of their own: Menu.tsx imports ContextMenu.tsx,
// so ContextMenu.tsx takes these from here rather than from Menu.tsx.

/**
 * Where ArrowDown, ArrowUp, Home and End take the keyboard among `n` items from item `i` (-1: from
 * none of them): the next one or the one before (round from the last to the first and back), the
 * first or the last. null for other keys.
 */
export function roveIndex(n: number, i: number, key: string): number | null {
  if (n < 1) return null;
  switch (key) {
    case "ArrowDown":
      return (i + 1) % n;
    case "ArrowUp":
      return i <= 0 ? n - 1 : i - 1;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return null;
  }
}

/**
 * Where PageDown (`down`) or PageUp takes the keyboard in a menu whose list scrolls, from entry `i`:
 * about a page further (`page`: the list's height in px), going by where the entries are (`tops`,
 * in px down the list). The furthest entry that starts less than a page below (above) it, at
 * least the next one (the one before), at most the last (the first).
 */
export function pageIndex(tops: number[], i: number, page: number, down: boolean): number {
  const n = tops.length;
  if (down) {
    let j = Math.min(i + 1, n - 1);
    while (j + 1 < n && tops[j + 1] - tops[i] < page) j++;
    return j;
  }
  let j = Math.max(i - 1, 0);
  while (j > 0 && tops[i] - tops[j - 1] < page) j--;
  return j;
}
