"use client";

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// A card description is plain text with a little Markdown: **bold**, *italic*, `code`, [text](url),
// bare links, "# " headings, "- " lists, "1. " lists and "[ ] " to-dos (clickable). It is turned into
// React elements (never HTML strings), so nothing anyone types can run in someone else's browser.

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** **bold**, *italic*, _italic_, `code`, [text](https://…) and bare https:// links. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?"'])|(\*([^*\s][^*]*)\*)|(\b_([^_]+)_\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k} className="font-semibold text-ink">{m[2]}</strong>);
    else if (m[4]) out.push(<code key={k} className="rounded bg-hover px-1 py-px font-mono text-[0.88em]">{m[4]}</code>);
    else if (m[6] && m[7]) out.push(link(m[7], m[6], k));
    else if (m[8]) out.push(link(m[8].startsWith("www.") ? `https://${m[8]}` : m[8], m[8], k));
    else if (m[10]) out.push(<em key={k}>{m[10]}</em>);
    else if (m[12]) out.push(<em key={k}>{m[12]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function link(href: string, label: string, key: string) {
  if (!SAFE_URL.test(href)) return <Fragment key={key}>{label}</Fragment>;
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-blob-ink underline decoration-blob/40 underline-offset-2 hover:decoration-blob" onClick={(e) => e.stopPropagation()}>
      {label}
    </a>
  );
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "todo"; items: { text: string; done: boolean; line: number }[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((raw, n) => {
    const line = raw.trimEnd();
    const prev = blocks[blocks.length - 1];
    let m: RegExpMatchArray | null;
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
    } else if ((m = line.match(/^\s*(?:[-*]\s+)?\[( |x|X)\]\s+(.*)$/))) {
      const item = { text: m[2], done: m[1].toLowerCase() === "x", line: n };
      if (prev?.kind === "todo") prev.items.push(item);
      else blocks.push({ kind: "todo", items: [item] });
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (prev?.kind === "ul") prev.items.push(m[1]);
      else blocks.push({ kind: "ul", items: [m[1]] });
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (prev?.kind === "ol") prev.items.push(m[1]);
      else blocks.push({ kind: "ol", items: [m[1]] });
    } else if ((m = line.match(/^#{1,3}\s+(.*)$/))) {
      blocks.push({ kind: "h", text: m[1] });
    } else if (prev?.kind === "p" && prev.lines.length) {
      prev.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  });
  return blocks.filter((b) => b.kind !== "p" || b.lines.length);
}

/** Tick a "[ ] " to-do on `line` of `text` (or untick it). */
export function toggleTodo(text: string, line: number) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines[line] = lines[line].replace(/\[( |x|X)\]/, (_, mark: string) => (mark === " " ? "[x]" : "[ ]"));
  return lines.join("\n");
}

export function RichText({ text, onToggle, className }: { text: string; onToggle?: (line: number) => void; className?: string }) {
  const blocks = parse(text);
  return (
    <div className={cn("space-y-2 text-[13.5px] leading-[1.6] text-ink-2 [overflow-wrap:anywhere]", className)}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        if (b.kind === "h") return <p key={key} className="pt-1 text-[14px] font-semibold text-ink">{inline(b.text, key)}</p>;
        if (b.kind === "ul")
          return (
            <ul key={key} className="list-disc space-y-0.5 pl-5 marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `${key}-${j}`)}</li>
              ))}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={key} className="list-decimal space-y-0.5 pl-5 marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `${key}-${j}`)}</li>
              ))}
            </ol>
          );
        if (b.kind === "todo")
          return (
            <ul key={key} className="space-y-1">
              {b.items.map((it) => (
                <li key={it.line} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={it.done}
                    disabled={!onToggle}
                    onChange={() => onToggle?.(it.line)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-[5px] size-3.5 shrink-0 accent-[var(--blob)]"
                  />
                  <span className={cn(it.done && "text-ink-3 line-through")}>{inline(it.text, `${key}-${it.line}`)}</span>
                </li>
              ))}
            </ul>
          );
        return (
          <p key={key}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
