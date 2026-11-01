"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import type { PartsView } from "../types";

/** How a marker looks in the quiz. */
export type Mark = "right" | "wrong";

/**
 * A labelled drawing you can touch. Every structure is a `<g data-part>` in the drawing: tapping
 * it (or its marker) picks it, the picked one glows and the rest step back. Markers stay the
 * same size on screen at any width; names sit in pills with leader lines when there is room,
 * else the markers show numbers that match the list.
 */
export function PartsStage({
  view,
  selected,
  onPick,
  labels,
  seen,
  marks,
  ask,
  quiz = false,
  className,
}: {
  view: PartsView;
  selected: string | null;
  onPick: (id: string) => void;
  /** Show the names (pills or numbers). */
  labels: boolean;
  /** Parts already opened: their markers are filled. */
  seen?: Set<string>;
  /** Quiz feedback on markers. */
  marks?: Record<string, Mark>;
  /** Quiz: the part asked about, its marker shows "?". */
  ask?: string | null;
  /** Quiz: no names on hover, nothing glows by itself. */
  quiz?: boolean;
  className?: string;
}) {
  const tt = useText();
  const uid = `atlas${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [wide, setWide] = useState(true);

  // Name pills only where they fit: below ~600px the markers show numbers instead.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const focus = selected ?? ask ?? null;
  const glow = focus ?? (quiz ? null : hover);
  const css = [
    `#${uid} [data-part]{transition:opacity .3s ease,filter .3s ease;cursor:pointer}`,
    `#${uid} [data-deco]{transition:opacity .3s ease}`,
    focus ? `#${uid} [data-part]:not([data-part="${focus}"]),#${uid} [data-deco]{opacity:.32}` : "",
    glow ? `#${uid} [data-part="${glow}"]{filter:drop-shadow(0 0 1.6px var(--blob)) drop-shadow(0 0 5px color-mix(in oklab,var(--blob) 35%,transparent))}` : "",
  ].join("");

  const pick = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.("[data-part]");
    const id = el?.getAttribute("data-part");
    if (id) onPick(id);
  };

  // Narrow screens crop to the drawing itself: the rows of name pills around it stay empty there.
  const [bx, by, bw, bh] = !wide && view.fit ? view.fit : [0, 0, view.width, view.height];
  const pct = (x: number, y: number): CSSProperties => ({ left: `${((x - bx) / bw) * 100}%`, top: `${((y - by) / bh) * 100}%` });
  const pills = labels && wide && !quiz;
  const numbers = labels && !pills;

  return (
    <div ref={box} className={cn("relative w-full select-none", className)} style={{ aspectRatio: `${bw} / ${bh}` }}>
      <svg
        id={uid}
        viewBox={`${bx} ${by} ${bw} ${bh}`}
        className="absolute inset-0 size-full overflow-visible"
        role="img"
        aria-label={tt(view.title)}
        onClick={(e) => pick(e.target)}
        onPointerOver={(e) => {
          if (e.pointerType !== "mouse") return;
          const id = (e.target as Element).closest?.("[data-part]")?.getAttribute("data-part") ?? null;
          setHover(id);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <style>{css}</style>
        <view.Drawing />
        {pills &&
          view.parts.map((p) => {
            const [x, y] = p.spot.at;
            const [lx, ly] = p.spot.label ?? [x + 26, y];
            if (lx === x && ly === y) return null;
            const on = focus === p.id || hover === p.id;
            return (
              <line
                key={p.id}
                x1={x}
                y1={y}
                x2={lx}
                y2={ly}
                stroke={on ? "var(--blob)" : "var(--ink-2)"}
                strokeWidth={on ? 1.6 : 1}
                strokeOpacity={on ? 1 : 0.55}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            );
          })}
      </svg>

      {/* Name pills (wide stages): HTML, so text stays crisp and the same size at any zoom. */}
      {pills &&
        view.parts.map((p) => {
          const [x] = p.spot.at;
          const [lx, ly] = p.spot.label ?? [x + 26, p.spot.at[1]];
          const side = p.spot.side ?? (lx < x ? "l" : "r");
          const on = focus === p.id || hover === p.id;
          return (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              onClick={() => onPick(p.id)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p.id)}
              onPointerLeave={() => setHover(null)}
              style={pct(lx, ly)}
              className={cn(
                "absolute z-10 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11.5px] font-semibold leading-none shadow-card transition-[background,color,border-color,opacity] duration-200",
                side === "l" ? "-translate-x-full" : side === "c" ? "-translate-x-1/2" : "",
                on ? "border-blob bg-blob text-white" : "border-line bg-raised/95 text-ink hover:border-blob/60",
                focus && !on && "opacity-45",
              )}
            >
              {tt(p.info.name)}
            </button>
          );
        })}

      {/* Markers: big invisible touch targets around a small dot. */}
      {view.parts.map((p, i) => {
        const [x, y] = p.spot.at;
        const isAsk = ask === p.id;
        const mark = marks?.[p.id];
        const on = selected === p.id;
        const done = seen?.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p.id)}
            onPointerLeave={() => setHover(null)}
            aria-label={quiz ? String(i + 1) : tt(p.info.name)}
            aria-pressed={on}
            title={quiz ? undefined : tt(p.info.name)}
            style={pct(x, y)}
            className="group absolute z-20 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
          >
            {isAsk && !mark && (
              <motion.span
                className="absolute size-6 rounded-full border-2 border-blob"
                initial={{ scale: 1, opacity: 0.9 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <span
              className={cn(
                "relative grid place-items-center rounded-full font-bold tabular-nums shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[width,height,background,border-color,transform] duration-200 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-blob group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-raised",
                mark === "right"
                  ? "size-6 border-2 border-white bg-ok text-white"
                  : mark === "wrong"
                    ? "size-6 border-2 border-white bg-danger text-white"
                    : isAsk
                      ? "size-6 border-2 border-white bg-blob text-[12px] text-white"
                      : on
                        ? pills
                          ? "size-3.5 border-2 border-white bg-blob"
                          : "size-[22px] border-[3px] border-white bg-blob text-[11px] text-white"
                        : pills
                          ? cn("size-2.5 border-2", done ? "border-white bg-blob" : "border-blob bg-raised")
                          : numbers
                          ? cn("size-5 border-[1.5px] text-[10.5px]", done ? "border-white bg-blob text-white" : "border-blob bg-raised text-ink")
                          : cn("size-3.5 border-2", done ? "border-white bg-blob" : "border-blob bg-raised"),
              )}
            >
              {mark === "right" ? (
                <Check className="size-3.5" strokeWidth={3.5} />
              ) : mark === "wrong" ? (
                <X className="size-3.5" strokeWidth={3.5} />
              ) : isAsk ? (
                "?"
              ) : numbers || (on && labels && !pills) ? (
                i + 1
              ) : null}
            </span>
          </button>
        );
      })}

      {/* The name under the pointer, when names are hidden (desktop). */}
      <AnimatePresence>
        {!quiz && !pills && hover && hover !== selected && (
          <HoverTag key={hover} view={view} id={hover} pct={pct} />
        )}
      </AnimatePresence>
    </div>
  );
}

function HoverTag({ view, id, pct }: { view: PartsView; id: string; pct: (x: number, y: number) => CSSProperties }) {
  const tt = useText();
  const part = view.parts.find((p) => p.id === id);
  if (!part) return null;
  const [x, y] = part.spot.at;
  const at = pct(x, y);
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[12px] font-semibold text-paper shadow-pop"
      style={{ left: at.left, top: `calc(${at.top} - 34px)` }}
    >
      {tt(part.info.name)}
    </motion.span>
  );
}
