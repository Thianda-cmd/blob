import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";

/**
 * Text with inline maths: "Multiply $3$ into $(x + 2)$." and **bold**.
 * Blank lines start a new paragraph.
 */
export function Rich({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/);
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

export function Inline({ text }: { text: string }) {
  // Bold first, so bold text may contain maths: "**Let $x$ be** the price".
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g).filter(Boolean);
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

function WithMath({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("$") && part.endsWith("$") && part.length > 2 ? (
          <MathView key={i} src={part.slice(1, -1)} size="inline" animate={false} className="mx-[0.1em] align-middle" />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
