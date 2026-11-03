"use client";

import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Locale } from "@/i18n/config";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { chartData } from "@/sheet/chart/data";
import { chartPng } from "@/sheet/chart/export";
import { CHART_WIDTH, embedPageId, embedTableMarkdown, embedTableModel, embedTarget, readEmbedItem, type EmbedCell, type EmbedTableModel, type SheetEmbedItem } from "@/sheet/embed";
import type { Workbook } from "@/sheet/types";
import { calcOf, privateSheets, setSheetLocale } from "./blocks/sheetEmbedData";

// Spreadsheet embeds in the note's exports. The exporters (src/notes/docx.ts and markdown.ts)
// know a note's ordinary blocks; an embed becomes those before it gets there:
//   Word      a chart → its picture (PNG); a table or cells → a real Word table
//   Markdown  a chart → "[Diagramm: Titel](link)"; a table or cells → a Markdown table
//   text      the same as Markdown
// with the caption under it. PDF needs nothing: it prints the note as it is on screen.

type Shown =
  | { kind: "chart"; title: string; pageId: string; png: () => Promise<Blob | null>; width: number }
  | { kind: "table"; model: EmbedTableModel; pageId: string; sheetTitle: string }
  | null;

const keyOf = (pageId: unknown, item: unknown) => `${String(pageId)}\n${JSON.stringify(item ?? null)}`;

/** The size a chart has on paper (a Word page is 600 px wide). */
const PAPER: Record<string, number> = { s: CHART_WIDTH.s, m: CHART_WIDTH.m, l: 600, full: 600 };

/** A spreadsheet for an export: its workbook and title, or null when it can't be read. */
export type SheetSource = (pageId: string) => Promise<{ wb: Workbook; title: string } | null>;

/** The signed-in reader's spreadsheets, fresh from the database (the note may have been open a while). */
const fromDatabase: SheetSource = async (pageId) => {
  await privateSheets.ensure(pageId, 5_000).catch(() => {});
  const load = privateSheets.get(pageId);
  return load.status === "ready" ? { wb: load.doc.wb, title: load.doc.title } : null;
};

/** Every embed of the document, loaded: what each one shows (null when it can't be shown). */
async function resolveAll(embeds: { pageId: unknown; item: unknown; size: unknown }[], locale: Locale, source: SheetSource): Promise<Map<string, Shown>> {
  setSheetLocale(locale);
  const out = new Map<string, Shown>();
  const pages = [...new Set(embeds.map((e) => embedPageId(e.pageId)).filter((x): x is string => !!x))];
  const loaded = new Map(await Promise.all(pages.map(async (id) => [id, await source(id).catch(() => null)] as const)));
  for (const e of embeds) {
    const key = keyOf(e.pageId, e.item);
    if (out.has(key)) continue;
    const pageId = embedPageId(e.pageId);
    const item = readEmbedItem(e.item);
    const sheet = pageId ? loaded.get(pageId) : null;
    if (!pageId || !item || !sheet) {
      out.set(key, null);
      continue;
    }
    out.set(key, shown(pageId, item, sheet.wb, sheet.title, locale, PAPER[String(e.size)] ?? PAPER.m));
  }
  return out;
}

function shown(pageId: string, item: SheetEmbedItem, wb: Workbook, sheetTitle: string, locale: Locale, width: number): Shown {
  const t = noteBlocksText[locale].sheet;
  try {
    const target = embedTarget(wb, item);
    const calc = calcOf(wb, locale);
    if (target.kind === "chart") {
      const spec = target.chart;
      const aspect = Math.min(0.95, Math.max(0.42, spec.size.h / Math.max(1, spec.size.w)));
      const size = { w: width, h: Math.round(width * aspect) };
      return {
        kind: "chart",
        title: spec.title.trim() || t.untitledChart,
        pageId,
        width,
        png: async () => {
          try {
            return await chartPng(spec, chartData(spec, calc, locale), locale, size);
          } catch {
            return null;
          }
        },
      };
    }
    if (target.kind === "gone") return null;
    const model = embedTableModel(wb, calc, item, locale);
    return model ? { kind: "table", model, pageId, sheetTitle: sheetTitle.trim() || t.untitled } : null;
  } catch {
    return null;
  }
}

function collect(node: JSONContent, out: JSONContent[] = []): JSONContent[] {
  if (node.type === "sheetEmbed") out.push(node);
  for (const c of node.content ?? []) collect(c, out);
  return out;
}

const text = (s: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: s, ...(marks?.length ? { marks } : {}) });

/** A paragraph of a table cell: its text (line breaks kept), bold/italic/underline/strike, alignment. */
function cellParagraph(c: EmbedCell, bold: boolean): JSONContent {
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (c.bold || bold) marks.push({ type: "bold" });
  if (c.italic) marks.push({ type: "italic" });
  if (c.underline) marks.push({ type: "underline" });
  if (c.strike) marks.push({ type: "strike" });
  const content: JSONContent[] = [];
  c.text.split("\n").forEach((line, i) => {
    if (i) content.push({ type: "hardBreak" });
    if (line) content.push(text(line, marks));
  });
  return { type: "paragraph", ...(c.align !== "left" ? { attrs: { align: c.align } } : {}), content };
}

function tableJson(model: EmbedTableModel): JSONContent {
  return {
    type: "table",
    content: model.rows.map((r) => ({
      type: "tableRow",
      content: r.cells.map((c) => ({
        type: r.part === "header" ? "tableHeader" : "tableCell",
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [cellParagraph(c, r.part === "totals")],
      })),
    })),
  };
}

const captionJson = (caption: string): JSONContent => ({ type: "paragraph", attrs: { align: "center" }, content: [text(caption, [{ type: "italic" }])] });

/**
 * The line above an exported table, as the block in the note names it: a smart table by its name,
 * cells by the spreadsheet they come from ("Kalibrierung · Blatt 1 · A1:B7", "Messung · Blatt 1 ·
 * A9:B10"; a range's own title is only its sheet's name, which `where` already says).
 */
const tableTitle = (s: Extract<Shown, { kind: "table" }>) => (s.model.kind === "table" ? s.model.title : s.sheetTitle);

/**
 * The document with every spreadsheet embed replaced by blocks the exporters know. For Word, charts
 * become pictures whose files live at blob: addresses until `done()` is called.
 */
export async function withSheetEmbeds(doc: JSONContent, target: "docx" | "markdown", locale: Locale, source: SheetSource = fromDatabase): Promise<{ doc: JSONContent; done: () => void }> {
  const embeds = collect(doc);
  if (!embeds.length) return { doc, done: () => {} };
  const t = noteBlocksText[locale].sheet;
  const resolved = await resolveAll(
    embeds.map((e) => ({ pageId: e.attrs?.pageId, item: e.attrs?.item, size: e.attrs?.size })),
    locale,
    source,
  );
  const urls: string[] = [];
  const pictures = new Map<string, string | null>();
  if (target === "docx") {
    for (const [key, s] of resolved) {
      if (s?.kind !== "chart") continue;
      const png = await s.png();
      const url = png ? URL.createObjectURL(png) : null;
      if (url) urls.push(url);
      pictures.set(key, url);
    }
  }

  const replace = (node: JSONContent): JSONContent[] => {
    if (node.type !== "sheetEmbed") return [{ ...node, ...(node.content ? { content: node.content.flatMap(replace) } : {}) }];
    const s = resolved.get(keyOf(node.attrs?.pageId, node.attrs?.item));
    const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
    const out: JSONContent[] = [];
    if (s?.kind === "chart") {
      const link = `/p/${s.pageId}`;
      const picture = pictures.get(keyOf(node.attrs?.pageId, node.attrs?.item));
      if (target === "docx" && picture) out.push({ type: "image", attrs: { src: picture, alt: t.exportChart(s.title), title: s.title, width: s.width } });
      else out.push({ type: "paragraph", content: [text(t.exportChart(s.title), [{ type: "link", attrs: { href: link } }])] });
    } else if (s?.kind === "table") {
      const m = s.model;
      out.push({ type: "paragraph", content: [text(tableTitle(s), [{ type: "bold" }]), text(` · ${m.where}`)] });
      out.push(tableJson(m));
      if (m.moreRows > 0 || m.moreCols > 0) {
        const more = [m.moreRows > 0 ? t.more(m.moreRows) : null, m.moreCols > 0 ? t.moreCols(m.moreCols) : null].filter(Boolean).join(" ");
        out.push({ type: "paragraph", content: [text(more, [{ type: "italic" }]), text(" "), text(t.openTitle(s.sheetTitle), [{ type: "link", attrs: { href: `/p/${s.pageId}` } }])] });
      }
    } else {
      // Not readable now (offline, deleted, not shared): at least where it was.
      const pageId = embedPageId(node.attrs?.pageId);
      if (pageId && readEmbedItem(node.attrs?.item)) out.push({ type: "paragraph", content: [text(t.label, [{ type: "link", attrs: { href: `/p/${pageId}` } }])] });
    }
    if (caption && out.length) out.push(captionJson(caption));
    return out;
  };

  return {
    doc: { ...doc, content: (doc.content ?? []).flatMap(replace) },
    done: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

/**
 * For the plain text export (editor.getText): what each embed reads as. A chart: "[Diagramm: Titel]"
 * and its address; a table: its Markdown.
 */
export async function sheetEmbedTexts(doc: PMNode, locale: Locale, pageHref: (id: string) => string, source: SheetSource = fromDatabase): Promise<(node: PMNode) => string> {
  const embeds: { pageId: unknown; item: unknown; size: unknown }[] = [];
  doc.descendants((node) => {
    if (node.type.name === "sheetEmbed") embeds.push({ pageId: node.attrs.pageId, item: node.attrs.item, size: node.attrs.size });
    return true;
  });
  const t = noteBlocksText[locale].sheet;
  const resolved = embeds.length ? await resolveAll(embeds, locale, source) : new Map<string, Shown>();
  return (node) => {
    const s = resolved.get(keyOf(node.attrs.pageId, node.attrs.item));
    const caption = typeof node.attrs.caption === "string" && node.attrs.caption.trim() ? `\n${node.attrs.caption.trim()}` : "";
    if (s?.kind === "chart") return `[${t.exportChart(s.title)}] ${pageHref(s.pageId)}${caption}`;
    if (s?.kind === "table") return `${tableTitle(s)} · ${s.model.where}\n\n${embedTableMarkdown(s.model)}${caption}`;
    return typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  };
}
