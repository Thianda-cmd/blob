// The colours of smart tables on the grid, from the --sheet-<colour> variables, so they follow dark
// mode: a strong tint for the header row with darker (in dark mode lighter) bold text and a line in
// the same colour below it, a very light tint for every other row, and the totals row in between.
// Fills are opaque (mixed with the cells' background), so text spilling over a neighbour doesn't
// tint twice.

import type { TableStyle } from "@/sheet/types";

const tint = (style: TableStyle, percent: number) => `color-mix(in oklab, var(--sheet-${style}) ${percent}%, var(--raised))`;

export const tableLook = (style: TableStyle) => ({
  headerFill: tint(style, 24),
  /** Header text and the lines under the header and above the totals row. */
  ink: `color-mix(in oklab, var(--sheet-${style}) 62%, var(--ink))`,
  bandFill: tint(style, 7),
  totalsFill: tint(style, 11),
  /** The solid colour (swatches). */
  solid: `var(--sheet-${style})`,
});
