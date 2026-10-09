// Building note content (Tiptap JSON) from text: for "save as note" (summaries, cheat sheets).
// Uses the note editor's blocks (src/components/editor/blocks/schema.ts): mathInline / mathBlock
// {src}, callout {kind}, table.

import type { CalloutKind, JNode, Line } from "./doc";

/** Inline nodes of a line (bold, italic and highlight marks; maths as mathInline). */
export function inlineNodes(line: Line): JNode[] {
  const out: JNode[] = [];
  for (const s of line) {
    if (s.math) {
      out.push({ type: "mathInline", attrs: { src: s.text } });
      continue;
    }
    const text = s.text;
    if (!text) continue;
    const marks = [
      ...(s.bold ? [{ type: "bold" }] : []),
      ...(s.italic ? [{ type: "italic" }] : []),
      ...(s.mark ? [{ type: "highlight" }] : []),
    ];
    // Hard breaks inside a line stay hard breaks.
    text.split("\n").forEach((part, i) => {
      if (i > 0) out.push({ type: "hardBreak" });
      if (part) out.push({ type: "text", text: part, ...(marks.length && { marks }) });
    });
  }
  return out;
}

export const paragraph = (line: Line): JNode => ({ type: "paragraph", content: inlineNodes(line) });
export const heading = (level: 1 | 2 | 3, line: Line): JNode => ({ type: "heading", attrs: { level }, content: inlineNodes(line) });
export const mathBlock = (src: string): JNode => ({ type: "mathBlock", attrs: { src } });
export const callout = (kind: CalloutKind, content: JNode[]): JNode => ({ type: "callout", attrs: { kind }, content });

/** A bullet list; items may carry a nested list. */
export function bulletList(items: { line: Line; children?: JNode }[]): JNode {
  return {
    type: "bulletList",
    content: items.map((it) => ({ type: "listItem", content: [paragraph(it.line), ...(it.children ? [it.children] : [])] })),
  };
}

export function table(rows: Line[][], header: boolean): JNode {
  const width = Math.max(...rows.map((r) => r.length));
  return {
    type: "table",
    content: rows.map((r, i) => ({
      type: "tableRow",
      content: Array.from({ length: width }, (_, c) => ({
        type: header && i === 0 ? "tableHeader" : "tableCell",
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [paragraph(r[c] ?? [])],
      })),
    })),
  };
}

export const doc = (content: JNode[]): JNode => ({ type: "doc", content: content.length ? content : [{ type: "paragraph" }] });

/**
 * The learning center's rich text ("Multiply $3$ into **the bracket**.") as a line: **bold** and
 * $maths$ (display language) become marks and maths.
 */
export function richLine(text: string): Line {
  const line: Line = [];
  for (const part of text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g)) {
    if (!part) continue;
    const bold = part.startsWith("**") && part.endsWith("**") && part.length > 4;
    const inner = bold ? part.slice(2, -2) : part;
    for (const bit of inner.split(/(\$[^$]+\$)/g)) {
      if (!bit) continue;
      if (bit.startsWith("$") && bit.endsWith("$") && bit.length > 2) line.push({ text: bit.slice(1, -1), math: true });
      else line.push({ text: bit, ...(bold && { bold: true }) });
    }
  }
  return line;
}
