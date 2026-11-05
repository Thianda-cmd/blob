// Class recipes for the app's surfaces, in the look of the calendar and the spreadsheet (the
// reference for every page): cards on paper, one soft lift on hover, dashed only where something
// can be added. Use them instead of hand-rolled borders, radii and shadows.

/** A card: raised white (dark: raised grey) with a hairline and the card shadow. */
export const card = "rounded-xl border border-line bg-raised shadow-card";

/** A card you can click: lifts a little on hover (not with reduced motion), a violet ring for the keyboard. */
export const cardLift =
  "transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** The one recommended choice on a start screen (like "Leere Tabelle" in the template picker). */
export const featured =
  "rounded-xl border border-blob/35 bg-blob-soft/50 transition-[border-color,background,transform] duration-200 hover:border-blob/70 hover:bg-blob-soft active:scale-[0.995] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** A tile that adds something ("+ Fach hinzufügen"): the only dashed border there is. Its text in ink-2 (it says what it adds). */
export const addTile =
  "rounded-xl border border-dashed border-line-2 text-ink-2 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** A small square for an icon in a card or row (colour it with a style or bg-* class). */
export const iconTile = "grid size-9 shrink-0 place-items-center rounded-lg";

/** A quiet panel inside a page (a side column, a group of settings). */
export const panel = "rounded-xl border border-line bg-raised/50 p-3.5 dark:bg-raised/40";

/** Small label above a group (sentence case, never violet capitals): "Demnächst", "Fächer". In the mid-tone: 4.5:1 and more. */
export const groupLabel = "text-[11.5px] font-medium text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]";

/** Small text that carries information: lighter than ink-2, still 4.5:1 and more on raised. */
export const midTone = "text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]";

/** A chip that is on (a filter, a chosen tab in a row of chips): violet-soft, never black. */
export const chipOn = "border-blob/40 bg-blob-soft text-blob-ink";
/** The same chip, off. */
export const chipOff = "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink";

/** A search field straight on the paper of a page (raised, with a hairline): Papierkorb, Lernen … */
export const searchOnPaper =
  "h-9 rounded-lg border border-line bg-raised px-3 text-[13px] text-ink shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] hover:border-line-2 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] [@media(hover:none)]:h-10";

/** A search or filter field inside a raised toolbar card (the formula bar's field: a paper well that turns white when focused). On bare paper use searchOnPaper. */
export const fieldClass =
  "h-8 rounded-lg border border-transparent bg-paper px-2.5 text-[13px] text-ink outline-none transition-[border-color,background,box-shadow] placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] hover:border-line focus:border-blob focus:bg-raised focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] [@media(hover:none)]:h-9";
