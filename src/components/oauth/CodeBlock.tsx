import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./Copy";

type Lang = "html" | "js" | "shell" | "json" | "text";

// Just enough colour to read code: strings and comments. Strings win, so "https://…" stays a string.
const PATTERNS: Record<Lang, RegExp | null> = {
  html: /("(?:[^"\\\n]|\\.)*")|(\/\/[^\n]*|<!--[\s\S]*?-->)/g,
  js: /("(?:[^"\\\n]|\\.)*")|(\/\/[^\n]*)/g,
  shell: /("(?:[^"\\\n]|\\.)*")|(^[ \t]*#[^\n]*)/gm,
  json: /("(?:[^"\\\n]|\\.)*")/g,
  text: null,
};

function highlight(code: string, lang: Lang): ReactNode[] {
  const pattern = PATTERNS[lang];
  if (!pattern) return [code];
  const re = new RegExp(pattern.source, pattern.flags);
  const out: ReactNode[] = [];
  let last = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    out.push(
      <span key={m.index} className={m[1] ? "text-blob-ink" : "text-ink-3"}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(code.slice(last));
  return out;
}

/** A code sample with a title bar and a copy button. */
export function CodeBlock({
  code,
  lang = "text",
  title,
  copyLabel,
  copiedLabel,
  className,
}: {
  code: string;
  lang?: Lang;
  title?: ReactNode;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface", className)}>
      <div className="flex h-9 items-center gap-2 border-b border-line pl-3.5 pr-1">
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-3">{title ?? lang}</span>
        <CopyButton value={code} label={copyLabel} copiedLabel={copiedLabel} withText className="h-7 border-0 bg-transparent shadow-none" />
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.7] text-ink">
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}
