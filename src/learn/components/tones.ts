// Class recipes for green "right" and "done" marks, shared by the study screens, the Atlas and the
// live quiz (plain strings, so any page can use them without pulling in the study screens).

/**
 * A filled green with white on it ("Wusste ich", a right answer, "Gespeichert"): a deeper green than
 * --ok, so white reads at 5.5:1 in both themes (on the plain --ok it is 4.3:1, in dark only 2.2:1).
 */
export const okFill = "bg-[color-mix(in_srgb,var(--ok)_85%,black)] text-white dark:bg-[color-mix(in_srgb,var(--ok)_60%,black)]";

/** Green text ("Richtig", "46 % kürzer"): mixed with ink, 4.5:1 and more on raised, paper and green tints. */
export const okText = "text-[color-mix(in_srgb,var(--ok)_75%,var(--ink))]";
