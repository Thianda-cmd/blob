import type { JSONContent } from "@tiptap/core";
import { Node as PMNode, Slice, type Schema } from "@tiptap/pm/model";

/** The user's own change, in the stored note's positions: replace `from`–`to` with `slice`. */
export type LocalChange = { from: number; to: number; slice: ReturnType<Slice["toJSON"]> };

/**
 * A note saved on its own was refused: others wrote to it together meanwhile. What the user changed
 * since their last save (base → local) becomes one change on top of the stored note, which the
 * collab plugin then rebases over the others' steps. "same": nothing to bring over. Null when it
 * can't be worked out (the stored note isn't the one last saved here, or unreadable documents).
 */
export function localChange(schema: Schema, stored: unknown, base: JSONContent | null, local: JSONContent): LocalChange | "same" | null {
  if (!base) return null;
  try {
    const a = PMNode.fromJSON(schema, base);
    const b = PMNode.fromJSON(schema, local);
    const start = a.content.findDiffStart(b.content);
    if (start === null) return "same";
    const end = a.content.findDiffEnd(b.content);
    if (!end) return "same";
    if (!stored || typeof stored !== "object" || !PMNode.fromJSON(schema, stored).eq(a)) return null;
    let { a: endA, b: endB } = end;
    // Repeated characters make both ends overlap; widen them (as ProseMirror's own examples do).
    const overlap = start - Math.min(endA, endB);
    if (overlap > 0) {
      endA += overlap;
      endB += overlap;
    }
    return { from: start, to: endA, slice: b.slice(start, endB).toJSON() };
  } catch {
    return null;
  }
}

export function sliceOf(schema: Schema, json: LocalChange["slice"]) {
  return Slice.fromJSON(schema, json);
}
