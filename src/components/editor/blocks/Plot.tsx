"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { parseFunction } from "./fn";

const COLORS = ["var(--blob)", "var(--subject-sky)", "var(--subject-moss)", "var(--subject-clay)", "var(--subject-rose)", "var(--subject-plum)"];
const NAMES = ["f", "g", "h", "k", "p", "q"];
const MAX_FUNCTIONS = 6;
/** Pixels per unit when the plot opens, and how far it may zoom. */
const START_SCALE = 42;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4000;

type View = { cx: number; cy: number; scale: number };

/** A tidy grid step (1, 2 or 5 × 10ⁿ) for about `px` pixels between lines. */
function niceStep(scale: number, px = 64) {
  const raw = px / scale;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
}

function PlotView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).plot;
  const locale = useLocale();
  const { canEdit } = useNoteBlocks();
  const clip = `plot-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const raw = node.attrs.fns as unknown;
  const stored = useMemo(() => (Array.isArray(raw) ? raw : []).filter((f): f is string => typeof f === "string").slice(0, MAX_FUNCTIONS), [raw]);
  const [drafts, setDrafts] = useState<string[] | null>(null);
  const fns = useMemo(() => drafts ?? (stored.length ? stored : [""]), [drafts, stored]);
  const parsed = useMemo(() => fns.map((src) => (src.trim() ? parseFunction(src) : null)), [fns]);

  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 300 });
  const [view, setView] = useState<View>({ cx: 0, cy: 0, scale: START_SCALE });
  const [hover, setHover] = useState<{ x: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; dist: number; mid: { x: number; y: number }; start: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Typing a function: save a moment after the last key.
  useEffect(() => {
    if (!drafts) return;
    const timer = setTimeout(() => {
      updateAttributes({ fns: drafts.filter((f, i) => f.trim() || i === 0) });
      // Saved: follow the document again (the others' changes, undo), unless an empty row waits for typing.
      setDrafts((d) => (d === drafts && d.every((f, i) => f.trim() || i === 0) ? null : d));
    }, 500);
    return () => clearTimeout(timer);
  }, [drafts, updateAttributes]);

  // Ctrl/⌘ + scroll (and trackpad pinch) zooms around the pointer; plain scrolling scrolls the note.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const { w, h } = size;
  const toPx = (x: number) => w / 2 + (x - view.cx) * view.scale;
  const toPy = (y: number) => h / 2 - (y - view.cy) * view.scale;
  const toX = (px: number) => view.cx + (px - w / 2) / view.scale;
  const toY = (py: number) => view.cy - (py - h / 2) / view.scale;

  function zoomAt(factor: number, px = w / 2, py = h / 2) {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      // Keep the point under the pointer where it is.
      const x = v.cx + (px - w / 2) / v.scale;
      const y = v.cy - (py - h / 2) / v.scale;
      return { scale, cx: x - (px - w / 2) / scale, cy: y + (py - h / 2) / scale };
    });
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { view, dist, mid, start: mid };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(e);
    if (e.pointerType === "mouse" && !pointers.current.size) setHover({ x: toX(p.x), px: p.x, py: p.y });
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length > 1 && g.dist > 0) {
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.view.scale * (dist / g.dist)));
      // The point first under the fingers' middle follows them.
      const x = g.view.cx + (g.mid.x - w / 2) / g.view.scale;
      const y = g.view.cy - (g.mid.y - h / 2) / g.view.scale;
      setView({ scale, cx: x - (mid.x - w / 2) / scale, cy: y + (mid.y - h / 2) / scale });
    } else {
      setView({ ...g.view, cx: g.view.cx - (p.x - g.start.x) / g.view.scale, cy: g.view.cy + (p.y - g.start.y) / g.view.scale });
    }
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const rest = [...pointers.current.values()];
    gesture.current = rest.length ? { view, dist: 0, mid: rest[0], start: rest[0] } : null;
  };

  // Grid, axes and labels.
  const step = niceStep(view.scale);
  const fmt = useMemo(() => {
    const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: digits });
    return (n: number) => nf.format(Math.abs(n) < step / 1e6 ? 0 : n).replace("-", "−");
  }, [step, locale]);
  const xs: number[] = [];
  for (let x = Math.ceil(toX(0) / step) * step; x <= toX(w); x += step) xs.push(x);
  const ys: number[] = [];
  for (let y = Math.ceil(toY(h) / step) * step; y <= toY(0); y += step) ys.push(y);
  const axisY = Math.min(h - 18, Math.max(2, toPy(0)));
  const axisX = Math.min(w - 4, Math.max(26, toPx(0)));

  const paths = parsed.map((f) => {
    if (!f) return "";
    let d = "";
    let pen = false;
    let lastY = 0;
    for (let px = -2; px <= w + 2; px += 1.5) {
      const y = f(toX(px));
      const py = toPy(y);
      // Off the chart, or a jump (an asymptote like 1/x at 0): lift the pen.
      if (!Number.isFinite(py) || py < -h * 4 || py > h * 5 || (pen && Math.abs(py - lastY) > h * 1.5)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
      pen = true;
      lastY = py;
    }
    return d;
  });

  const setFn = (i: number, value: string) => {
    const next = [...fns];
    next[i] = value;
    setDrafts(next);
  };
  const removeFn = (i: number) => {
    const next = fns.filter((_, j) => j !== i);
    setDrafts(next.length ? next : [""]);
  };

  const hoverValues = hover
    ? parsed
        .map((f, i) => ({ i, y: f ? f(hover.x) : NaN }))
        .filter((v) => Number.isFinite(v.y))
    : [];

  return (
    <NodeViewWrapper className={cn("blob-plot blob-object", selected && "blob-node-selected")}>
      <div contentEditable={false}>
        <div
          ref={box}
          className="blob-plot-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={(e) => {
            const p = local(e);
            zoomAt(1.6, p.x, p.y);
          }}
          role="img"
          aria-label={`${t.label}: ${fns.filter(Boolean).map((f, i) => `${NAMES[i]}(x) = ${f}`).join("; ")}`}
        >
          <svg width={w} height={h} className="block">
            <defs>
              <clipPath id={clip}>
                <rect x={0} y={0} width={w} height={h} />
              </clipPath>
            </defs>
            <g className="blob-plot-grid">
              {xs.map((x) => (
                <line key={`x${x}`} x1={toPx(x)} x2={toPx(x)} y1={0} y2={h} />
              ))}
              {ys.map((y) => (
                <line key={`y${y}`} x1={0} x2={w} y1={toPy(y)} y2={toPy(y)} />
              ))}
            </g>
            <g className="blob-plot-axes">
              <line x1={0} x2={w} y1={axisY} y2={axisY} />
              <line x1={axisX} x2={axisX} y1={0} y2={h} />
              <path d={`M${w - 7} ${axisY - 4}L${w - 1} ${axisY}L${w - 7} ${axisY + 4}`} />
              <path d={`M${axisX - 4} 7L${axisX} 1L${axisX + 4} 7`} />
            </g>
            <g className="blob-plot-labels">
              {xs
                .filter((x) => Math.abs(x) > step / 2 && toPx(x) > 14 && toPx(x) < w - 14)
                .map((x) => (
                  <text key={`lx${x}`} x={toPx(x)} y={axisY + 14} textAnchor="middle">
                    {fmt(x)}
                  </text>
                ))}
              {ys
                .filter((y) => Math.abs(y) > step / 2 && toPy(y) > 10 && toPy(y) < h - 10)
                .map((y) => (
                  <text key={`ly${y}`} x={axisX - 5} y={toPy(y) + 4} textAnchor="end">
                    {fmt(y)}
                  </text>
                ))}
              <text x={w - 10} y={axisY - 7} textAnchor="end" className="blob-plot-axisname">
                x
              </text>
              <text x={axisX + 8} y={14} className="blob-plot-axisname">
                y
              </text>
            </g>
            <g clipPath={`url(#${clip})`}>
              {paths.map((d, i) => (d ? <path key={i} d={d} className="blob-plot-curve" style={{ stroke: COLORS[i % COLORS.length] }} /> : null))}
              {hover && (
                <>
                  <line x1={hover.px} x2={hover.px} y1={0} y2={h} className="blob-plot-cross" />
                  {hoverValues.map((v) => (
                    <circle key={v.i} cx={hover.px} cy={toPy(v.y)} r={4} style={{ fill: COLORS[v.i % COLORS.length] }} className="blob-plot-dot" />
                  ))}
                </>
              )}
            </g>
          </svg>
          {hover && hoverValues.length > 0 && (
            <div className="blob-plot-readout">
              <span>x = {fmtValue(hover.x, locale)}</span>
              {hoverValues.map((v) => (
                <span key={v.i} style={{ color: COLORS[v.i % COLORS.length] }}>
                  {NAMES[v.i]}(x) = {fmtValue(v.y, locale)}
                </span>
              ))}
            </div>
          )}
          <div className="blob-plot-zoom" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => zoomAt(1.5)} aria-label={t.zoomIn} title={t.zoomIn}>
              <Plus className="size-3.5" />
            </button>
            <button type="button" onClick={() => zoomAt(1 / 1.5)} aria-label={t.zoomOut} title={t.zoomOut}>
              <Minus className="size-3.5" />
            </button>
            <button type="button" onClick={() => setView({ cx: 0, cy: 0, scale: START_SCALE })} aria-label={t.reset} title={t.reset}>
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="blob-plot-fns" aria-label={t.functions}>
          {fns.map((src, i) => {
            const invalid = !!src.trim() && !parsed[i];
            return (
              <div key={i} className={cn("blob-plot-fn", invalid && "is-invalid")}>
                <span className="blob-plot-swatch" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
                <label className="blob-plot-name" htmlFor={`${clip}-f${i}`}>
                  {NAMES[i]}(x) =
                </label>
                {canEdit ? (
                  <input
                    id={`${clip}-f${i}`}
                    data-open-editor={i === 0 ? "" : undefined}
                    value={src}
                    onChange={(e) => setFn(i, e.target.value)}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).focus()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && fns.length < MAX_FUNCTIONS && src.trim()) {
                        e.preventDefault();
                        setDrafts([...fns, ""]);
                        requestAnimationFrame(() => document.getElementById(`${clip}-f${fns.length}`)?.focus());
                      }
                    }}
                    placeholder={t.placeholder}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-invalid={invalid}
                    className="blob-plot-input"
                  />
                ) : (
                  <span className="blob-plot-input">{src}</span>
                )}
                {canEdit && (fns.length > 1 || src) && (
                  <button type="button" onClick={() => removeFn(i)} className="blob-plot-remove" aria-label={t.remove} title={t.remove}>
                    <X className="size-3.5" />
                  </button>
                )}
                {invalid && <span className="blob-plot-error">{t.invalid}</span>}
              </div>
            );
          })}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {fns.length < MAX_FUNCTIONS && (
                <button
                  type="button"
                  className="blob-plot-add"
                  onClick={() => {
                    setDrafts([...fns, ""]);
                    requestAnimationFrame(() => document.getElementById(`${clip}-f${fns.length}`)?.focus());
                  }}
                >
                  <Plus className="size-3.5" />
                  {t.add}
                </button>
              )}
              <span className="blob-plot-hint">{t.hint}</span>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function fmtValue(n: number, locale: "de" | "en") {
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 3;
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: digits }).format(n).replace("-", "−");
}

/** Graphs of functions y = f(x), with zoom and panning. */
export const Plot = Node.create({
  name: "plot",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      fns: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-fns") ?? "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ "data-fns": JSON.stringify(attrs.fns ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-plot]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-plot": "" })];
  },

  renderText({ node }) {
    const fns = Array.isArray(node.attrs.fns) ? (node.attrs.fns as string[]) : [];
    return fns
      .filter(Boolean)
      .map((f, i) => `${NAMES[i]}(x) = ${f}`)
      .join(", ");
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlotView);
  },
});
