import type { Modifier } from "@dnd-kit/core";

/** Drag only up and down (checklist items). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
