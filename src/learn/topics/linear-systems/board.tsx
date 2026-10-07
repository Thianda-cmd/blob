"use client";

import { useMemo } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, type Text } from "@/i18n/text";
import { MathView } from "@/learn/components/MathView";
import { parseDisplay, type DNode } from "@/learn/engine/display";

// ---------------------------------------------------------------------------
// A task card for systems with three rows. The task card shows `math` at a fixed
// 46 px, and a 3×3 system is about 10–11 em wide: at phone width its right sides
// were cut off. This card scales the font with its own width instead (container
// units), so the widest row always fits, and stays at 46 px on wide screens.

const RELATIONS = new Set(["=", "<", ">", "≤", "≥", "≠", "≈", "⇒", "⇔", "→", "∈"]);
const BINARY = new Set(["+", "−", "·", "×", ":", "/", "±"]);

/** Rough width in em (close to the rendered maths font; a little generous). */
function width(nodes: DNode[]): number {
  let sum = 0;
  nodes.forEach((n, i) => {
    const prev = nodes[i - 1];
    switch (n.type) {
      case "num":
        sum += 0.52 * n.v.length;
        break;
      case "var":
      case "sym":
        sum += 0.58;
        break;
      case "text":
        sum += 0.44 * n.v.length + 0.5;
        break;
      case "space":
        sum += n.v === "quad" ? 1 : n.v === "med" ? 0.28 : 0.18;
        break;
      case "op": {
        const unary = n.v === "−" && (!prev || prev.type !== "num" && prev.type !== "var" && prev.type !== "paren");
        sum += RELATIONS.has(n.v) ? 1.36 : BINARY.has(n.v) && !unary ? 1.04 : 0.56;
        break;
      }
      case "frac":
        sum += Math.max(width(n.num), width(n.den)) * 0.88 + 0.3;
        break;
      case "pow":
      case "sub":
        sum += width(n.base) + 0.64 * width(n.type === "pow" ? n.exp : n.sub);
        break;
      case "sqrt":
        sum += 0.62 + width(n.body);
        break;
      case "paren":
        sum += 0.72 + width(n.body);
        break;
      case "style":
        sum += width(n.body);
        break;
    }
  });
  return sum;
}

/** Width of the widest row (rows are separated by line breaks). */
export function rowsEm(src: string): number {
  const rows: DNode[][] = [[]];
  for (const n of parseDisplay(src)) {
    if (n.type === "space" && n.v === "br") rows.push([]);
    else rows[rows.length - 1].push(n);
  }
  return Math.max(...rows.map(width));
}

/**
 * Width of the widest labelled row or other style group (\group{…}, \blob{…}) or bracket: these
 * never wrap, while plain tokens around them can. A worked solution with a group wider than about 11 em gets
 * clipped in the solution player at phone width.
 */
export function groupEm(src: string): number {
  let best = 0;
  for (const n of parseDisplay(src)) if (n.type === "style" || n.type === "paren") best = Math.max(best, width([n]));
  return best;
}

/** The system of a task, as big as the card allows (at most like the usual task maths). */
export function SystemCard({ src }: { src: Text }) {
  const locale = useLocale();
  const source = resolveText(src, locale);
  const em = useMemo(() => rowsEm(source), [source]);
  // MathView at size "inline" is 1.05em of this box. The box is 100cqw minus its padding
  // (2 × 12 px, about 7 % at phone width); 6 % spare for the estimate.
  const fontSize = `min(${(46 / 1.05).toFixed(1)}px, ${(88 / (1.05 * 1.06 * em)).toFixed(2)}cqw)`;
  return (
    <div className="relative" style={{ containerType: "inline-size" }}>
      <div className="bg-dots pointer-events-none absolute inset-0 rounded-xl opacity-25" />
      <div className="relative grid min-h-[124px] place-items-center overflow-x-auto px-3 py-6" style={{ fontSize }}>
        <MathView src={source} size="inline" />
      </div>
    </div>
  );
}
