"use client";

import { Fragment } from "react";
import { MathView } from "@/learn/components/MathView";
import type { Line } from "@/notes/doc";
import { cn } from "@/lib/utils";

/**
 * A line of note text: bold, italic and highlighted runs, maths (rendered like in the learning
 * center) and cloze gaps. `reveal` shows a gap's word highlighted instead of the gap.
 */
export function RichLine({ line, className, mathSize = "inline" }: { line: Line; className?: string; mathSize?: "inline" | "sm" | "md" }) {
  return (
    <span className={className}>
      {line.map((s, i) => {
        if (s.math) return <MathView key={i} src={s.text} size={mathSize} animate={false} className="mx-[0.1em] align-middle" />;
        if (s.blank) {
          return (
            <span key={i} className="relative mx-0.5 inline-block rounded-md border-b-2 border-blob bg-blob-soft/70 px-1 align-baseline">
              {/* The hidden word keeps the gap as wide as the answer (and stays hidden from screen readers too). */}
              <span aria-hidden className="select-none text-transparent">
                {s.text}
              </span>
              <span className="sr-only">___</span>
            </span>
          );
        }
        let node = <Fragment>{s.text}</Fragment>;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong className="font-semibold text-ink">{node}</strong>;
        if (s.mark) node = <mark className="rounded-[4px] bg-blob-soft px-0.5 text-blob-ink">{node}</mark>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </span>
  );
}

/** Several lines: a list when there are a few short ones, paragraphs otherwise. */
export function RichLines({ lines, className, list }: { lines: Line[]; className?: string; list?: boolean }) {
  if (lines.length === 1) return <RichLine line={lines[0]} className={className} />;
  if (list) {
    return (
      <ul className={cn("space-y-1.5 text-left", className)}>
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-blob/70" aria-hidden />
            <RichLine line={l} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <span className={cn("block space-y-2", className)}>
      {lines.map((l, i) => (
        <span key={i} className="block">
          <RichLine line={l} />
        </span>
      ))}
    </span>
  );
}
