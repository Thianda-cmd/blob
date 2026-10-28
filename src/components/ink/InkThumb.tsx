"use client";

import { useMemo } from "react";
import { useDark } from "@/components/editor/blocks/useDark";
import { PREVIEW_K, type InkPreview, type Template } from "@/ink/model";
import { inkColor, lookOf, templateLines } from "@/ink/render";
import { cn } from "@/lib/utils";

const W = 1000 * PREVIEW_K;
const H = 1414 * PREVIEW_K;

const templatePaths = new Map<Template, { fine: string; strong: string; dots: string }>();

/** A template as SVG path data in preview units. */
function templatePath(tpl: Template) {
  let p = templatePaths.get(tpl);
  if (p) return p;
  const t = templateLines(tpl);
  const f = (v: number) => Math.round(v * PREVIEW_K * 10) / 10;
  const lines = (list: number[]) => {
    let d = "";
    for (let i = 0; i < list.length; i += 4) d += `M${f(list[i])} ${f(list[i + 1])}L${f(list[i + 2])} ${f(list[i + 3])}`;
    return d;
  };
  let dots = "";
  for (let i = 0; i < t.dots.length; i += 2) dots += `M${f(t.dots[i])} ${f(t.dots[i + 1])}h0`;
  // Millimetres are too close together for a card: the centimetre lines say "graph paper".
  p = { fine: tpl === "mm" ? "" : lines(t.fine), strong: lines(t.strong), dots };
  templatePaths.set(tpl, p);
  return p;
}

/**
 * The first sheet of a handwritten note, small (from the preview saved with it). `crop` shows only
 * the top of the sheet (cards), else the whole page.
 */
export function InkThumb({ preview, crop = 0.62, className }: { preview: InkPreview | null | undefined; crop?: number; className?: string }) {
  const dark = useDark();
  const look = lookOf(preview?.paper ?? "auto", dark);
  const tpl = templatePath(preview?.tpl ?? "lined");
  const h = Math.round(H * crop);
  const lines = useMemo(() => preview?.lines ?? [], [preview]);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="xMidYMin slice" aria-hidden className={cn("block w-full", className)} style={{ background: look.paper }}>
      {tpl.fine && <path d={tpl.fine} stroke={look.line} strokeWidth={0.6} fill="none" />}
      {tpl.strong && <path d={tpl.strong} stroke={look.strong} strokeWidth={0.8} fill="none" />}
      {tpl.dots && <path d={tpl.dots} stroke={look.strong} strokeWidth={1.1} strokeLinecap="round" fill="none" />}
      {/* Pictures show as where they are (the files themselves stay out of lists). */}
      {preview?.pics?.map(([x, y, w, ph, rot], i) => (
        <rect key={i} x={x} y={y} width={w} height={ph} rx={2} fill={look.dark ? "rgba(255,255,255,0.09)" : "rgba(28,27,24,0.07)"} transform={rot ? `rotate(${(rot * 180) / Math.PI} ${x + w / 2} ${y + ph / 2})` : undefined} />
      ))}
      {lines.map(([color, width, d, alpha], i) => (
        <path key={i} d={d} fill="none" stroke={inkColor(color, look.dark)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={alpha < 1 ? alpha : undefined} />
      ))}
      {preview?.texts?.map(([color, size, x, y, text], i) => (
        <text key={i} fill={inkColor(color, look.dark)} fontSize={size} style={{ fontFamily: "inherit" }}>
          {text.split("\n").map((line, k) => (
            <tspan key={k} x={x} y={y + k * size * 1.35 + size * 0.95}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </svg>
  );
}
