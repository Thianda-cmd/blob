"use client";

import { NodeSelection } from "@tiptap/pm/state";
import { AttrStep, type Step } from "@tiptap/pm/transform";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Eraser, Highlighter, MoveVertical, PenLine, Pencil, Redo2, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { caretAfter, openEditorAt } from "./insert";
import { SKETCH_DEFAULT_HEIGHT, SketchSpec } from "./schema";
import { AddStrokesStep, RemoveStrokesStep, SKETCH_COLORS, newStrokeId, strokesOf, type PlacedStroke, type SketchColor, type Stroke } from "./sketchSteps";

const COLORS = SKETCH_COLORS;
/** Theme colours, so a drawing reads well in light and dark mode (ink turns light in the dark). */
const COLOR_VAR: Record<SketchColor, string> = {
  ink: "var(--ink)",
  blob: "var(--blob)",
  sky: "var(--subject-sky)",
  moss: "var(--subject-moss)",
  clay: "var(--subject-clay)",
  rose: "var(--subject-rose)",
};
type Tool = "pen" | "marker" | "eraser";
const WIDTH = 1000;
const MAX_HEIGHT = 2400;
const PEN_WIDTH = 3.2;
const MARKER_WIDTH = 18;

type Point = [number, number];

/** A smooth path through the points (quadratic curves through the midpoints). */
function toPath(points: Point[]) {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${r(x)} ${r(y)}l0.01 0`;
  }
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${r(x)} ${r(y)} ${r((x + nx) / 2)} ${r((y + ny) / 2)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d}L${r(lx)} ${r(ly)}`;
}

/** The points a path goes through (good enough to find what the eraser touches). */
function pathPoints(d: string): Point[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const out: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

/** One change of this drawing session, for its own undo: strokes drawn, or strokes erased (with where they were). */
type Change = { kind: "add"; strokes: Stroke[] } | { kind: "remove"; placed: PlacedStroke[] };

function SketchView({ node, editor, getPos, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText);
  const s = t.sketch;
  const { canEdit } = useNoteBlocks();
  const strokes = strokesOf(node.attrs.paths);
  const height = Math.min(MAX_HEIGHT, Math.max(200, Number(node.attrs.height) || SKETCH_DEFAULT_HEIGHT));
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<SketchColor>("ink");
  const [live, setLive] = useState<Point[] | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef<{ id: number; points: Point[] } | null>(null);
  /** Strokes the eraser already took during this gesture (the drawing redraws a moment later). */
  const erased = useRef(new Set<string>());
  const sawPen = useRef(false);
  // This drawing session's own undo (the note's undo works too, change by change).
  const [history, setHistory] = useState<{ undo: Change[]; redo: Change[] }>({ undo: [], redo: [] });

  /** Make a change to this sketch: strokes are added and removed by id, so others drawing at the same time keep theirs. */
  const run = (step: (pos: number) => Step) => {
    const pos = getPos();
    if (typeof pos !== "number" || editor.isDestroyed) return false;
    editor.view.dispatch(editor.state.tr.step(step(pos)));
    return true;
  };
  const apply = (change: Change) =>
    change.kind === "add"
      ? run((pos) => new AddStrokesStep(pos, change.strokes.map((stroke) => ({ stroke }))))
      : run((pos) => new RemoveStrokesStep(pos, change.placed.map((p) => p.stroke.id)));
  const inverse = (change: Change): Change =>
    change.kind === "add" ? { kind: "remove", placed: change.strokes.map((stroke) => ({ stroke })) } : { kind: "add", strokes: change.placed.map((p) => p.stroke) };
  const commit = (change: Change) => {
    if (apply(change)) setHistory((h) => ({ undo: [...h.undo.slice(-49), change], redo: [] }));
  };
  /** Strokes to erase, each with the stroke it was drawn after (so undo puts it back in its place). */
  const removal = (ids: Set<string>): Change => ({
    kind: "remove",
    placed: strokes.flatMap((st, i) => (ids.has(st.id) ? [{ stroke: st, after: i ? strokes[i - 1].id : null }] : [])),
  });

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect();
    const k = WIDTH / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };

  const eraseAt = (p: Point) => {
    const radius = 14;
    const hit = strokes.find((st) => !erased.current.has(st.id) && pathPoints(st.d).some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < radius + st.w / 2));
    if (!hit) return;
    erased.current.add(hit.id);
    commit(removal(new Set([hit.id])));
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!editing || (e.pointerType === "mouse" && e.button !== 0)) return;
    // With a pen on the screen, a resting hand (touch) doesn't draw.
    if (e.pointerType === "pen") sawPen.current = true;
    if (e.pointerType === "touch" && sawPen.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    if (tool === "eraser") {
      drawing.current = { id: e.pointerId, points: [] };
      erased.current = new Set();
      eraseAt(p);
      return;
    }
    drawing.current = { id: e.pointerId, points: [p] };
    setLive([p]);
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const cur = drawing.current;
    if (!cur || cur.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    if (tool === "eraser") {
      eraseAt(toPoint(e));
      return;
    }
    for (const ev of events) {
      const p = toPoint(ev);
      const last = cur.points[cur.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.2) cur.points.push(p);
    }
    setLive([...cur.points]);
  };

  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const cur = drawing.current;
    if (!cur || cur.id !== e.pointerId) return;
    drawing.current = null;
    setLive(null);
    if (tool === "eraser" || !cur.points.length) return;
    const k = tool === "marker" ? "marker" : "pen";
    commit({ kind: "add", strokes: [{ id: newStrokeId(), d: toPath(cur.points), c: color, w: k === "marker" ? MARKER_WIDTH : PEN_WIDTH, k }] });
  };

  const finish = () => {
    setEditing(false);
    setHistory({ undo: [], redo: [] });
    const pos = getPos();
    if (typeof pos === "number" && !editor.isDestroyed) caretAfter(editor, pos);
  };

  const doUndo = () => {
    const last = history.undo[history.undo.length - 1];
    if (!last || !apply(inverse(last))) return;
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, last] }));
  };
  const doRedo = () => {
    const next = history.redo[history.redo.length - 1];
    if (!next || !apply(next)) return;
    setHistory((h) => ({ undo: [...h.undo, next], redo: h.redo.slice(0, -1) }));
  };
  // The height is an attribute of its own: growing the sketch never touches the strokes.
  const taller = () => run((pos) => new AttrStep(pos, "height", Math.min(MAX_HEIGHT, height + 200)));
  const undoRef = useRef(doUndo);
  const redoRef = useRef(doRedo);
  const finishRef = useRef(finish);
  useEffect(() => {
    undoRef.current = doUndo;
    redoRef.current = doRedo;
    finishRef.current = finish;
  });

  // While drawing: Ctrl/⌘+Z undoes strokes, Escape finishes.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        e.preventDefault();
        finishRef.current();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        (e.shiftKey ? redoRef : undoRef).current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing]);

  const tools: { id: Tool; icon: LucideIcon; label: string }[] = [
    { id: "pen", icon: PenLine, label: s.pen },
    { id: "marker", icon: Highlighter, label: s.marker },
    { id: "eraser", icon: Eraser, label: s.eraser },
  ];

  const strokeEl = (st: Omit<Stroke, "id">, key: string, ghost = false) => (
    <path
      key={key}
      d={st.d}
      fill="none"
      stroke={COLOR_VAR[st.c] ?? COLOR_VAR.ink}
      strokeWidth={st.w}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={st.k === "marker" ? 0.32 : ghost ? 0.85 : 1}
    />
  );

  return (
    <NodeViewWrapper className={cn("blob-sketch blob-object", editing && "is-editing", selected && !editing && "blob-node-selected")}>
      <div contentEditable={false} className="relative">
        {editing && (
          <div className="blob-sketch-bar" role="toolbar" aria-label={s.label}>
            <div className="flex items-center gap-0.5">
              {tools.map(({ id, icon: Icon, label }) => (
                <ToolButton key={id} label={label} active={tool === id} onClick={() => setTool(id)} icon={Icon} />
              ))}
            </div>
            <span className="blob-sketch-sep" aria-hidden />
            <div className="flex items-center gap-1" role="radiogroup" aria-label={s.color(s.colors[color])}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={s.color(s.colors[c])}
                  title={s.colors[c]}
                  onClick={() => {
                    setColor(c);
                    if (tool === "eraser") setTool("pen");
                  }}
                  className={cn("blob-sketch-swatch", color === c && "is-on")}
                  style={{ ["--swatch" as string]: COLOR_VAR[c] }}
                />
              ))}
            </div>
            <span className="blob-sketch-sep" aria-hidden />
            <div className="flex items-center gap-0.5">
              <ToolButton label={s.undo} onClick={doUndo} icon={Undo2} disabled={!history.undo.length} />
              <ToolButton label={s.redo} onClick={doRedo} icon={Redo2} disabled={!history.redo.length} />
              <ToolButton label={s.taller} onClick={taller} icon={MoveVertical} />
              <ToolButton label={s.clear} onClick={() => strokes.length && commit(removal(new Set(strokes.map((st) => st.id))))} icon={Trash2} danger disabled={!strokes.length} />
            </div>
            <button type="button" onClick={finish} className="blob-done ml-auto">
              {t.done}
            </button>
          </div>
        )}
        <svg
          ref={svg}
          viewBox={`0 0 ${WIDTH} ${height}`}
          className={cn("blob-sketch-canvas", editing && `is-drawing tool-${tool}`)}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={() => canEdit && !editing && setEditing(true)}
          role="img"
          aria-label={s.label}
        >
          {strokes.map((st) => strokeEl(st, st.id))}
          {live && strokeEl({ d: toPath(live), c: color, w: tool === "marker" ? MARKER_WIDTH : PEN_WIDTH, k: tool === "marker" ? "marker" : "pen" }, "live", true)}
        </svg>
        {!strokes.length && !live && <div className="blob-sketch-empty">{s.empty}</div>}
        {canEdit && !editing && (
          <button type="button" data-open-editor onClick={() => setEditing(true)} className="blob-block-edit" aria-label={s.draw} title={s.draw}>
            <Pencil className="size-3.5" />
            <span>{s.draw}</span>
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function ToolButton({ label, icon: Icon, onClick, active, disabled, danger }: { label: string; icon: LucideIcon; onClick: () => void; active?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("blob-sketch-tool", active && "is-on", danger && "is-danger")}
    >
      <Icon className="size-4" strokeWidth={1.9} />
    </button>
  );
}

/** A hand-drawn sketch (pen, mouse or finger), stored as SVG paths. */
export const Sketch = SketchSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SketchView);
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name || !editor.isEditable) return false;
        openEditorAt(editor, sel.from, 0);
        return true;
      },
    };
  },
});

