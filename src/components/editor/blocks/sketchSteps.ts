import { Fragment, Slice, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Step, StepMap, StepResult, type Mappable } from "@tiptap/pm/transform";
import { hash } from "@/notes/text";

// A sketch's strokes change through two steps of their own instead of rewriting its whole "paths"
// attribute: "add these strokes" and "remove these ids". Both work by id, so they commute: when
// two people draw at the same moment and one change is rebased over the other, both strokes stay
// (and so does erasing or clearing what you saw). Registered with Step.jsonID below, so every place
// that builds the note schema (the editor, and the server in src/notes/settle.ts) can read them.

export const SKETCH_COLORS = ["ink", "blob", "sky", "moss", "clay", "rose"] as const;
export type SketchColor = (typeof SKETCH_COLORS)[number];

/** One stroke: its id, SVG path data in a 1000-unit-wide drawing, its colour, width and tool. */
export type Stroke = { id: string; d: string; c: SketchColor; w: number; k: "pen" | "marker" };

/** A stroke to add, and (when undoing an eraser) the stroke it was drawn right after (null: first). */
export type PlacedStroke = { stroke: Stroke; after?: string | null };

const PATH = /^[MQLlml0-9.\s-]+$/;

/** A new stroke id: short, random, never like the ones older strokes get (those start with "s"). */
export const newStrokeId = () => `n${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`;

/**
 * The strokes stored in a sketch, each with an id. Strokes drawn before strokes had ids get one
 * from what they look like, the same for everyone who loads the note (the steps below then write
 * them out with the ids).
 */
export function strokesOf(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  const seen = new Map<string, number>();
  for (const s of raw as Partial<Stroke>[]) {
    if (!s || typeof s !== "object" || typeof s.d !== "string" || !PATH.test(s.d)) continue;
    let id = typeof s.id === "string" && s.id ? s.id : "";
    if (!id) {
      const base = `s${hash(`${s.d}|${s.c}|${s.w}|${s.k}`)}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      id = n ? `${base}-${n}` : base;
    }
    out.push({ ...(s as Stroke), id });
  }
  return out;
}

function validStroke(s: unknown): s is Stroke {
  const x = s as Stroke | null;
  return !!x && typeof x === "object" && typeof x.id === "string" && !!x.id && typeof x.d === "string" && PATH.test(x.d);
}

function sketchAt(doc: PMNode, pos: number) {
  const node = doc.nodeAt(pos);
  return node && node.type.name === "sketch" ? node : null;
}

function withStrokes(doc: PMNode, pos: number, node: PMNode, strokes: Stroke[]) {
  const updated = node.type.create({ ...node.attrs, paths: strokes }, null, node.marks);
  return StepResult.fromReplace(doc, pos, pos + 1, new Slice(Fragment.from(updated), 0, 0));
}

/** The sketch moved with the text around it; gone when the sketch itself was deleted. */
function mapPos(mapping: Mappable, pos: number) {
  const r = mapping.mapResult(pos, 1);
  return r.deletedAfter ? null : r.pos;
}

/** Adds strokes the sketch at `pos` doesn't have yet. Nothing happens when the sketch is gone. */
export class AddStrokesStep extends Step {
  constructor(
    readonly pos: number,
    readonly strokes: PlacedStroke[],
  ) {
    super();
  }

  apply(doc: PMNode) {
    const node = sketchAt(doc, this.pos);
    if (!node) return StepResult.ok(doc);
    const list = strokesOf(node.attrs.paths);
    const ids = new Set(list.map((s) => s.id));
    let changed = false;
    for (const { stroke, after } of this.strokes) {
      if (ids.has(stroke.id)) continue;
      ids.add(stroke.id);
      changed = true;
      // New strokes go on top; a stroke brought back by undo goes back where it was, if it can.
      const at = after === undefined ? list.length : after === null ? 0 : list.findIndex((s) => s.id === after) + 1 || list.length;
      list.splice(at, 0, stroke);
    }
    return changed ? withStrokes(doc, this.pos, node, list) : StepResult.ok(doc);
  }

  getMap() {
    return StepMap.empty;
  }

  invert(doc: PMNode): Step {
    const had = new Set(strokesOf(sketchAt(doc, this.pos)?.attrs.paths).map((s) => s.id));
    return new RemoveStrokesStep(
      this.pos,
      this.strokes.map((p) => p.stroke.id).filter((id) => !had.has(id)),
    );
  }

  map(mapping: Mappable) {
    const pos = mapPos(mapping, this.pos);
    return pos === null ? null : new AddStrokesStep(pos, this.strokes);
  }

  merge() {
    return null;
  }

  toJSON() {
    return { stepType: "sketchAdd", pos: this.pos, strokes: this.strokes.map((p) => (p.after === undefined ? { stroke: p.stroke } : p)) };
  }

  static fromJSON(_schema: Schema, json: { pos?: unknown; strokes?: unknown }) {
    const strokes = json.strokes as PlacedStroke[];
    if (typeof json.pos !== "number" || !Array.isArray(strokes) || !strokes.every((p) => p && validStroke(p.stroke) && (p.after === undefined || p.after === null || typeof p.after === "string"))) {
      throw new RangeError("Invalid input for AddStrokesStep.fromJSON");
    }
    return new AddStrokesStep(json.pos, strokes);
  }
}

/** Removes strokes by id from the sketch at `pos` (erasing one, or clearing all you saw). */
export class RemoveStrokesStep extends Step {
  constructor(
    readonly pos: number,
    readonly ids: string[],
  ) {
    super();
  }

  apply(doc: PMNode) {
    const node = sketchAt(doc, this.pos);
    if (!node) return StepResult.ok(doc);
    const list = strokesOf(node.attrs.paths);
    const gone = new Set(this.ids);
    const next = list.filter((s) => !gone.has(s.id));
    return next.length === list.length ? StepResult.ok(doc) : withStrokes(doc, this.pos, node, next);
  }

  getMap() {
    return StepMap.empty;
  }

  invert(doc: PMNode): Step {
    const list = strokesOf(sketchAt(doc, this.pos)?.attrs.paths);
    const gone = new Set(this.ids);
    const back: PlacedStroke[] = [];
    list.forEach((s, i) => {
      if (gone.has(s.id)) back.push({ stroke: s, after: i ? list[i - 1].id : null });
    });
    return new AddStrokesStep(this.pos, back);
  }

  map(mapping: Mappable) {
    const pos = mapPos(mapping, this.pos);
    return pos === null ? null : new RemoveStrokesStep(pos, this.ids);
  }

  merge() {
    return null;
  }

  toJSON() {
    return { stepType: "sketchRemove", pos: this.pos, ids: this.ids };
  }

  static fromJSON(_schema: Schema, json: { pos?: unknown; ids?: unknown }) {
    if (typeof json.pos !== "number" || !Array.isArray(json.ids) || !json.ids.every((id) => typeof id === "string")) {
      throw new RangeError("Invalid input for RemoveStrokesStep.fromJSON");
    }
    return new RemoveStrokesStep(json.pos, json.ids as string[]);
  }
}

// (A hot reload in development runs this file again: the first registration stays.)
for (const [id, step] of [
  ["sketchAdd", AddStrokesStep],
  ["sketchRemove", RemoveStrokesStep],
] as const) {
  try {
    Step.jsonID(id, step);
  } catch {}
}
