"use client";

import { Fragment } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, type Text } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";

/**
 * Text with inline maths: "Multiply $3$ into $(x + 2)$." and **bold**.
 * Blank lines start a new paragraph.
 */
export function Rich({ text, className }: { text: Text; className?: string }) {
  const paragraphs = resolveText(text, useLocale()).split(/\n{2,}/);
  return (
    <span className={cn("block space-y-2", className)}>
      {paragraphs.map((para, pi) => (
        <span key={pi} className="block">
          <Inline text={para} />
        </span>
      ))}
    </span>
  );
}

export function Inline({ text }: { text: Text }) {
  // Bold first, so bold text may contain maths: "**Let $x$ be** the price".
  const parts = resolveText(text, useLocale()).split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-semibold text-ink">
            <WithMath text={part.slice(2, -2)} />
          </strong>
        ) : (
          <WithMath key={i} text={part} />
        ),
      )}
    </>
  );
}

const isMath = (part: string) => part.startsWith("$") && part.endsWith("$") && part.length > 2;

function WithMath({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (isMath(part)) {
          const math = <MathView src={part.slice(1, -1)} size="inline" animate={false} className="mx-[0.1em] align-middle" />;
          // Punctuation right after the maths stays on its line ("… $x = 3$, so …").
          const tail = !isMath(parts[i + 1] ?? "") ? (parts[i + 1]?.match(/^[,.;:!?)]+/)?.[0] ?? "") : "";
          return tail ? (
            <span key={i} className="whitespace-nowrap">
              {math}
              {tail}
            </span>
          ) : (
            <Fragment key={i}>{math}</Fragment>
          );
        }
        const prev = parts[i - 1];
        const cut = prev && isMath(prev) ? (part.match(/^[,.;:!?)]+/)?.[0].length ?? 0) : 0;
        return <Fragment key={i}>{cut ? part.slice(cut) : part}</Fragment>;
      })}
    </>
  );
}
