"use client";

import { useMemo } from "react";
import { useDark } from "@/components/editor/blocks/useDark";
import type { InkPreview, Template } from "@/ink/model";
import { PREVIEW_K } from "@/ink/preview";
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
  p = { fine: lines(t.fine), strong: lines(t.strong), dots };
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
      {lines.map(([color, width, d, alpha], i) => (
        <path key={i} d={d} fill="none" stroke={inkColor(color, look.dark)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={alpha < 1 ? alpha : undefined} />
      ))}
    </svg>
  );
}
