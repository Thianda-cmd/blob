/**
 * Where a chart's or smart table's settings open (src/components/sheet/SheetEditor.tsx): from this
 * editor width (px) on they sit beside the grid in a panel PANEL_WIDTH px wide; narrower editors
 * dock them over the lower part of the editor. ChartLayer uses the same numbers to guess where a new
 * chart can be seen once its settings open. In their own module: importing SheetEditor from the
 * chart layer would be an import cycle.
 */
export const PANEL_MIN_WIDTH = 900;
export const PANEL_WIDTH = 352;
