"use client";

import { motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { useText } from "@/i18n/useText";
import type { Text } from "@/i18n/text";
import { cn } from "@/lib/utils";

/** A named structure in a drawing: where its marker sits and what it's called. */
export type FigurePart = {
  /** Matches `data-part="<id>"` on the drawing's SVG group for that structure. */
  id: string;
  /** Its name, e.g. tx("nucleus", "Zellkern"). */
  label: Text;
  /** Where the marker points to, in viewBox units (on the structure itself). */
  at: [number, number];
  /** Where the marker bubble sits, if it should not sit right on the structure. A thin line joins them. */
  tag?: [number, number];
  /** One short line about what it does (shown in "explore" mode and the legend). */
  info?: Text;
};

export type FigureMode =
  /** Numbered markers with a legend of names (to learn the parts). */
  | "names"
  /** Numbered markers, legend shows only numbers (for "what is number 3?"). */
  | "numbers"
  /** Tap a marker or a name to see what that part does. */
  | "explore"
  /** Just the drawing. */
  | "plain";

/**
 * A biology drawing with numbered markers and a legend that works on phones: the legend sits
 * beside the drawing on wide screens and below it on narrow ones, and stays readable at any
 * size. Hovering or tapping a name highlights the structure (`data-part` groups) in the drawing.
 *
 *   <Figure title={tx("Plant cell", "Pflanzenzelle")} width={360} height={240} parts={PARTS} mode="names">
 *     <g data-part="wall">…</g>
 *   </Figure>
 */
export function Figure({
  title,
  width,
  height,
  parts,
  mode = "names",
  show,
  ask,
  highlight,
  selected: selectedProp,
  onSelect,
  legend = "auto",
  className,
  children,
}: {
  /** What the drawing shows (for screen readers, and as a small caption). */
  title: Text;
  width: number;
  height: number;
  parts: FigurePart[];
  mode?: FigureMode;
  /** Only these parts get a marker (default: all). Numbers follow the order of `parts`. */
  show?: string[];
  /** A part to ask about: its marker shows "?" and gently pulses. */
  ask?: string;
  /** Parts to highlight from outside (e.g. a lesson step). */
  highlight?: string[];
  /** Controlled selection for "explore" mode. */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** Where the legend goes: "auto" (side when wide, below when narrow), "below" or "none". */
  legend?: "auto" | "below" | "none";
  className?: string;
  children: ReactNode;
}) {
  const tt = useText();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hover, setHover] = useState<string | null>(null);
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : ownSelected;
  const select = (id: string | null) => (onSelect ? onSelect(id) : setOwnSelected(id));

  const visible = parts.filter((p) => !show || show.includes(p.id));
  // Markers keep about the same size on screen for any viewBox (drawings are shown up to 640px wide).
  const k = Math.max(0.6, width / 480);
  const numberOf = (id: string) => parts.findIndex((p) => p.id === id) + 1;
  const lit = new Set([...(highlight ?? []), ...(hover ? [hover] : []), ...(selected ? [selected] : [])]);
  const markers = mode !== "plain";
  const withLegend = markers && legend !== "none" && (mode === "names" || mode === "explore");
  const picked = selected ? parts.find((p) => p.id === selected) : undefined;

  // Lit parts get a soft purple glow and the others step back a little.
  const css = lit.size
    ? `#${uid} [data-part]{transition:opacity .25s,filter .25s}` +
      `#${uid} [data-part]:not(${[...lit].map((id) => `[data-part="${id}"]`).join(",")}){opacity:.55}` +
      [...lit].map((id) => `#${uid} [data-part="${id}"]{filter:drop-shadow(0 0 3px var(--blob)) drop-shadow(0 0 1px var(--blob))}`).join("")
    : "";

  return (
    <figure className={cn("w-full", className)}>
      <div className={cn("grid gap-4", withLegend && legend === "auto" && "md:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] md:items-center")}>
        <div className="relative min-w-0">
          <svg id={uid} style={{ maxWidth: 640 }} viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full" role="img" aria-label={tt(title)}>
            {css && <style>{css}</style>}
            {children}
            {markers &&
              visible.map((p) => {
                const n = numberOf(p.id);
                const [x, y] = p.tag ?? p.at;
                const isAsk = ask === p.id;
                const on = lit.has(p.id);
                return (
                  <g
                    key={p.id}
                    className={cn(mode === "explore" && "cursor-pointer")}
                    onPointerEnter={() => setHover(p.id)}
                    onPointerLeave={() => setHover(null)}
                    onClick={mode === "explore" ? () => select(selected === p.id ? null : p.id) : undefined}
                  >
                    {p.tag && <line x1={p.at[0]} y1={p.at[1]} x2={x} y2={y} stroke="var(--ink-2)" strokeWidth={1.2 * k} strokeDasharray={`${2 * k} ${2 * k}`} />}
                    {p.tag && <circle cx={p.at[0]} cy={p.at[1]} r={2.2 * k} fill="var(--ink)" />}
                    {isAsk && (
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={11 * k}
                        fill="none"
                        stroke="var(--blob)"
                        strokeWidth={2}
                        initial={{ scale: 1, opacity: 0.8 }}
                        animate={{ scale: 1.7, opacity: 0 }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        style={{ transformBox: "fill-box", transformOrigin: "center" }}
                      />
                    )}
                    <circle cx={x} cy={y} r={9.5 * k} fill={isAsk || on ? "var(--blob)" : "var(--raised)"} stroke={isAsk || on ? "var(--blob)" : "var(--ink)"} strokeWidth={1.4 * k} />
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11 * k}
                      fontWeight={700}
                      fill={isAsk || on ? "#fff" : "var(--ink)"}
                      style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}
                    >
                      {isAsk ? "?" : n}
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>
        {withLegend && (
          <ol className="grid content-start gap-1 text-[13.5px] sm:grid-cols-2 md:grid-cols-1">
            {visible.map((p) => {
              const on = lit.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onPointerEnter={() => setHover(p.id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => mode === "explore" && select(selected === p.id ? null : p.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors",
                      on ? "bg-blob-soft text-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
                      mode !== "explore" && "cursor-default",
                    )}
                  >
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", on ? "bg-blob text-white" : "border border-ink text-ink")}>
                      {numberOf(p.id)}
                    </span>
                    <span className="min-w-0 leading-snug">{tt(p.label)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {mode === "explore" && (
        <motion.div
          key={picked?.id ?? "none"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 min-h-[3.25rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug"
          aria-live="polite"
        >
          {picked ? (
            <>
              <span className="font-semibold text-ink">{tt(picked.label)}</span>
              {picked.info && <span className="text-ink-2">: {tt(picked.info)}</span>}
            </>
          ) : (
            <span className="text-ink-3">{tt(title)}</span>
          )}
        </motion.div>
      )}
    </figure>
  );
}

/** Props a drawing component usually takes, so it can be a lesson widget and a task picture alike. */
export type DrawingProps = { mode?: FigureMode; show?: string[]; ask?: string; highlight?: string[]; legend?: "auto" | "below" | "none" };
