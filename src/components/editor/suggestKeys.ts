import { PluginKey, type EditorState } from "@tiptap/pm/state";

/** The "/" menu and the "[[" page search (Suggestion plugins). */
export const slashPluginKey = new PluginKey("slashCommand");
export const pageRefPluginKey = new PluginKey("pageRef");

/**
 * Whether a suggestion menu is open: its keys (arrows, Enter, Tab) belong to the menu then, not to
 * block shortcuts like "Enter opens the toggle" or "ArrowUp jumps to the title".
 */
export function suggestionOpen(state: EditorState) {
  return Boolean((slashPluginKey.getState(state) as { active?: boolean } | undefined)?.active || (pageRefPluginKey.getState(state) as { active?: boolean } | undefined)?.active);
}
