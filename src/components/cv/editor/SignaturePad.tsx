"use client";

import { Eraser, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { CvSignature } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { useTrapFocus } from "./useTrapFocus";

export type Point = { x: number; y: number };

/** Ink on the pad and on the CV (SignatureMark's default). */
const INK = "#1f2a44";
const PAD_STROKE = 2.6;
/** The normaliser keeps path data under what the CV format stores (40 000 characters). */
const MAX_PATH = 38000;
/**
 * At most this many times as wide as high. The CV draws the signature 13 mm high: a long flat line
 * would otherwise run across the whole page (or off it). Flatter drawings get room above and below.
 */
const MAX_RATIO = 5;

const f = (n: number) => String(Math.round(n * 10) / 10);

/**
 * A smooth line through the points: quadratic curves from midpoint to midpoint, with each point as
 * the control. A single tap becomes a dot.
 */
function strokePath(points: Point[]) {
  const [first] = points;
  if (points.length === 1) return `M${f(first.x)} ${f(first.y)} L${f(first.x + 0.1)} ${f(first.y)}`;
  if (points.length === 2) return `M${f(first.x)} ${f(first.y)} L${f(points[1].x)} ${f(points[1].y)}`;
  let d = `M${f(first.x)} ${f(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const n = points[i + 1];
    d += ` Q${f(p.x)} ${f(p.y)} ${f((p.x + n.x) / 2)} ${f((p.y + n.y) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${f(last.x)} ${f(last.y)}`;
}

/** Drops points closer than `gap` to the one before (keeps the last), so paths stay small. */
function thin(points: Point[], gap: number) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    if (Math.hypot(points[i].x - a.x, points[i].y - a.y) >= gap) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** The drawing as CvSignature: path data in a box that fits the strokes plus a little padding. */
function toSignature(strokes: Point[][]): CvSignature | null {
  const all = strokes.flat();
  if (!all.length) return null;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(6, (maxY - minY) * 0.08);
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  const extra = Math.max(0, (w / MAX_RATIO - h) / 2);
  // Most of that room goes above, so the signature still sits just over the line on the CV.
  const shift = (p: Point) => ({ x: p.x - minX + pad, y: p.y - minY + pad + extra * 1.5 });
  let gap = 1.5;
  let d = "";
  do {
    d = strokes.map((s) => strokePath(thin(s, gap).map(shift))).join(" ");
    gap *= 1.6;
  } while (d.length > MAX_PATH && gap < 60);
  return { d, w: Math.round(w * 10) / 10, h: Math.round((h + 2 * extra) * 10) / 10 };
}

/**
 * A drawing pad for the signature: mouse, pen or finger; undo the last stroke, start over, done.
 * `onClose` gets what is drawn so far: Escape or a click beside the pad keeps it for next time,
 * "Cancel" throws it away.
 */
export function SignaturePad({
  open,
  initial,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Strokes from last time the pad was closed without "Cancel". */
  initial?: Point[][];
  onClose: (draft: Point[][]) => void;
  onDone: (signature: CvSignature) => void;
}) {
  const t = useMessages(cvEditorText).signature.pad;
  const [strokes, setStrokes] = useState<Point[][]>(initial ?? []);
  const live = useRef<{ id: number; points: Point[] } | null>(null);
  const livePath = useRef<SVGPathElement>(null);
  const padRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useTrapFocus(open, boxRef);

  const point = (e: { clientX: number; clientY: number }): Point => {
    const r = padRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (live.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { id: e.pointerId, points: [point(e)] };
    livePath.current?.setAttribute("d", strokePath(live.current.points));
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const s = live.current;
    if (!s || s.id !== e.pointerId) return;
    // Fast strokes: the browser groups several positions into one event.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = point(ev);
      const last = s.points[s.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) s.points.push(p);
    }
    // Drawn straight into the DOM: no React render for every movement.
    livePath.current?.setAttribute("d", strokePath(s.points));
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const s = live.current;
    if (!s || s.id !== e.pointerId) return;
    live.current = null;
    livePath.current?.setAttribute("d", "");
    setStrokes((list) => [...list, s.points]);
  };

  // Ctrl/Cmd+Z takes back the last stroke while the pad is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Not Ctrl+Shift+Z (redo elsewhere): there is nothing to redo here.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setStrokes((list) => list.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const done = () => {
    const signature = toSignature(strokes);
    if (signature) onDone(signature);
  };

  return (
    <Dialog open={open} onClose={() => onClose(strokes)} labelledBy="cv-sign-title" className="max-w-[520px]">
      <div ref={boxRef} className="p-5">
        <h2 id="cv-sign-title" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {t.title}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">{t.hint}</p>

        {/* Always paper white: the signature is printed on white. */}
        <div className="relative mt-4 h-[190px] overflow-hidden rounded-xl border border-line bg-white shadow-[inset_0_1px_3px_rgb(0_0_0/0.06)] sm:h-[210px]">
          <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-[30%] flex items-end gap-2 border-b-[1.5px] border-dashed border-[#c9cbd3] pb-1">
            <span className="text-[20px] leading-none text-[#9a9ca6]">×</span>
          </div>
          {!strokes.length && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[calc(30%-22px)] text-center text-[12px] text-[#9a9ca6]">
              {t.here}
            </span>
          )}
          <svg
            ref={padRef}
            role="img"
            aria-label={t.area}
            className="absolute inset-0 size-full cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <g fill="none" stroke={INK} strokeWidth={PAD_STROKE} strokeLinecap="round" strokeLinejoin="round">
              {strokes.map((s, i) => (
                <path key={i} d={strokePath(s)} />
              ))}
              <path ref={livePath} />
            </g>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setStrokes((list) => list.slice(0, -1))} disabled={!strokes.length}>
            <Undo2 className="size-3.5" /> {t.undo}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStrokes([])} disabled={!strokes.length}>
            <Eraser className="size-3.5" /> {t.clear}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onClose([])}>
              {t.cancel}
            </Button>
            <Button variant="blob" onClick={done} disabled={!strokes.length}>
              {t.done}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
