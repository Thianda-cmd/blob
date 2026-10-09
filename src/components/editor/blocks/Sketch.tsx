"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Eraser, Highlighter, MoveVertical, PenLine, Pencil, Redo2, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { caretAfter, openEditorAt } from "./insert";

/** One stroke: SVG path data in a 1000-unit-wide drawing, its colour, width and tool. */
export type Stroke = { d: string; c: SketchColor; w: number; k: "pen" | "marker" };

const COLORS = ["ink", "blob", "sky", "moss", "clay", "rose"] as const;
type SketchColor = (typeof COLORS)[number];
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
const DEFAULT_HEIGHT = 420;
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

function normalizeStrokes(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Stroke => !!s && typeof s === "object" && typeof (s as Stroke).d === "string" && /^[MQLlml0-9.\s-]+$/.test((s as Stroke).d),
  );
}

function SketchView({ node, updateAttributes, editor, getPos, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText);
  const s = t.sketch;
  const { canEdit } = useNoteBlocks();
  const strokes = normalizeStrokes(node.attrs.paths);
  const height = Math.min(MAX_HEIGHT, Math.max(200, Number(node.attrs.height) || DEFAULT_HEIGHT));
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<SketchColor>("ink");
  const [live, setLive] = useState<Point[] | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef<{ id: number; points: Point[] } | null>(null);
  const sawPen = useRef(false);
  // This drawing session's own undo (the note's undo works too, change by change).
  const [history, setHistory] = useState<{ undo: Stroke[][]; redo: Stroke[][] }>({ undo: [], redo: [] });

  const commit = (next: Stroke[], record = true) => {
    if (record) setHistory((h) => ({ undo: [...h.undo.slice(-49), strokes], redo: [] }));
    updateAttributes({ paths: next });
  };

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect();
    const k = WIDTH / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };

  const eraseAt = (p: Point) => {
    const radius = 14;
    const hit = strokes.findIndex((st) => pathPoints(st.d).some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < radius + st.w / 2));
    if (hit >= 0) commit(strokes.filter((_, i) => i !== hit));
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
    commit([...strokes, { d: toPath(cur.points), c: color, w: k === "marker" ? MARKER_WIDTH : PEN_WIDTH, k }]);
  };

  const finish = () => {
    setEditing(false);
    setHistory({ undo: [], redo: [] });
    const pos = getPos();
    if (typeof pos === "number" && !editor.isDestroyed) caretAfter(editor, pos);
  };

  const doUndo = () => {
    const prev = history.undo[history.undo.length - 1];
    if (!prev) return;
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, strokes] }));
    commit(prev, false);
  };
  const doRedo = () => {
    const next = history.redo[history.redo.length - 1];
    if (!next) return;
    setHistory((h) => ({ undo: [...h.undo, strokes], redo: h.redo.slice(0, -1) }));
    commit(next, false);
  };
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

  const strokeEl = (st: Stroke, key: string | number, ghost = false) => (
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
              <ToolButton label={s.taller} onClick={() => updateAttributes({ height: Math.min(MAX_HEIGHT, height + 200) })} icon={MoveVertical} />
              <ToolButton label={s.clear} onClick={() => strokes.length && commit([])} icon={Trash2} danger disabled={!strokes.length} />
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
          {strokes.map((st, i) => strokeEl(st, i))}
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
export const Sketch = Node.create({
  name: "sketch",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      paths: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-paths") ?? "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ "data-paths": JSON.stringify(attrs.paths ?? []) }),
      },
      height: {
        default: DEFAULT_HEIGHT,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || DEFAULT_HEIGHT,
        renderHTML: (attrs) => ({ "data-height": attrs.height }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-sketch]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-sketch": "" })];
  },

  renderText() {
    return "";
  },

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

