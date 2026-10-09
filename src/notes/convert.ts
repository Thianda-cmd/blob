// Notes made by Blob: a summary saved as a note, and a learning-center cheat sheet saved as a note.

import type { Locale } from "@/i18n/config";
import { resolveText } from "@/i18n/text";
import type { Level, SummaryBlock } from "@/learn/types";
import { docText, type JNode, type Line } from "./doc";
import type { Summary } from "./study/summary";
import { bulletList, callout, doc, heading, mathBlock, paragraph, richLine, table } from "./tiptap";

export type NewNoteContent = { content: JNode; plain_text: string };

const withText = (content: JNode): NewNoteContent => ({ content, plain_text: docText(content).slice(0, 20000) });

/** Headings for a saved summary, in the student's language. */
export type SummaryLabels = { gist: string; terms: string; dates: string; formulas: string; source: (title: string) => string };

/** A summary as a note: the gist, each section's key points, then terms, dates and formulas. */
export function summaryNote(summary: Summary, title: string, labels: SummaryLabels, sourceId?: string): NewNoteContent {
  const out: JNode[] = [];
  // Where it comes from: a link to the original note.
  if (sourceId) {
    out.push({
      type: "paragraph",
      content: [{ type: "text", text: labels.source(title), marks: [{ type: "italic" }, { type: "link", attrs: { href: `/p/${sourceId}` } }] }],
    });
  }
  if (summary.gist.length) {
    out.push(callout("idea", [paragraph([{ text: labels.gist, bold: true }]), ...summary.gist.map((l) => paragraph(l))]));
  }
  for (const s of summary.sections) {
    if (s.heading) out.push(heading(s.level <= 1 ? 2 : 3, s.heading));
    let items: { line: Line }[] = [];
    const flush = () => {
      if (items.length) out.push(bulletList(items));
      items = [];
    };
    for (const p of s.points) {
      if (p.kind === "item" || p.kind === "sentence") items.push({ line: p.line });
      else {
        flush();
        if (p.kind === "rule") out.push(callout("rule", [paragraph(p.line)]));
        else if (p.kind === "math") out.push(mathBlock(p.src));
        else if (p.kind === "table") out.push(table(p.rows, p.header));
      }
    }
    flush();
  }
  if (summary.terms.length) {
    out.push(heading(2, [{ text: labels.terms }]));
    out.push(bulletList(summary.terms.map((t) => ({ line: [...t.term.map((x) => ({ ...x, bold: true })), { text: ": " }, ...t.meaning] }))));
  }
  if (summary.dates.length) {
    out.push(heading(2, [{ text: labels.dates }]));
    out.push(bulletList(summary.dates.map((d) => ({ line: [...d.date.map((x) => ({ ...x, bold: true })), { text: " – " }, ...d.event] }))));
  }
  if (summary.formulas.length) {
    out.push(heading(2, [{ text: labels.formulas }]));
    for (const f of summary.formulas) {
      if (f.label) out.push(paragraph([{ text: `${f.label}:` }]));
      out.push(mathBlock(f.src));
    }
  }
  return withText(doc(out));
}

/** A level's cheat sheet as a note, starting with a link to the lesson. */
export function cheatSheetNote(blocks: SummaryBlock[], slug: string, level: Level, locale: Locale): NewNoteContent {
  const t = (x: Parameters<typeof resolveText>[0]) => resolveText(x, locale);
  const out: JNode[] = [{ type: "lessonLink", attrs: { slug, level } }];
  for (const b of blocks) {
    const title = richLine(t(b.title));
    const body = (b.body ? t(b.body) : "").split(/\n{2,}/).filter((x) => x.trim()).map((x) => paragraph(richLine(x.trim())));
    const examples = (b.examples ?? []).map((e) => mathBlock(t(e)));
    if (b.tone === "tip" || b.tone === "warning") {
      out.push(callout(b.tone === "tip" ? "idea" : "warning", [paragraph(title.map((s) => ({ ...s, bold: true }))), ...body, ...examples]));
    } else {
      out.push(heading(3, title), ...body, ...examples);
    }
  }
  return withText(doc(out));
}
