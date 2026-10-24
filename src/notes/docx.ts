// Notes as Word documents (.docx): the "Word" export. Runs in the browser; the caller fetches the
// pictures and draws the diagrams, plots and sketches (useNoteExport.tsx).
//
// What a note has becomes what Word has: headings, text with its sizes, colours and highlighter,
// lists with their own markers and numbers (and text under an item), checklists with real
// checkboxes, tables, quotes and code. Formulas become Word equations you can still edit, callouts
// shaded paragraphs with a coloured edge, flashcards a two-column table, links to Blob pages links
// to the site.

import type { JSONContent } from "@tiptap/core";
import {
  AlignmentType,
  BorderStyle,
  CheckBox,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Math as WordMath,
  MathAngledBrackets,
  MathCurlyBrackets,
  MathFraction,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSquareBrackets,
  MathSubScript,
  MathSuperScript,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ILevelsOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { PLOT_NAMES, toDisplay } from "@/components/editor/blocks/schema";
import type { Locale } from "@/i18n/config";
import { resolveText } from "@/i18n/text";
import { findTopicMeta, topicHref } from "@/learn/catalog";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import { exportWords } from "./markdown";

/** A picture for the document: PNG, JPEG or GIF, at its size in px. */
export type DocxImage = { data: Uint8Array; type: "png" | "jpg" | "gif"; width: number; height: number };

export type DocxOptions = {
  locale: Locale;
  title: string;
  /** A link to a Blob page. */
  pageHref: (id: string) => string;
  /** Any other link, made absolute (links in a note can be relative to the site). */
  absolute: (href: string) => string;
  /** A page's title, for links to pages that don't store one. */
  pageTitle?: (id: string) => string | undefined;
  /** A picture's file, by its address. */
  image: (src: string) => Promise<DocxImage | null>;
  /** Diagrams, plots and sketches as pictures, in the order they come in the note. */
  drawings: (DocxImage | null)[];
};

// Looks -------------------------------------------------------------------------------------------

const FONT = "Calibri";
const MONO = "Consolas";
/** Word sizes are half-points; a note's 16 px text is 12 pt. */
const BASE = 24;
const halfPoints = (px: number) => Math.round(px * 1.5);
/** The page's width for text (A4 with 2.5 cm margins), in px. */
const PAGE_PX = 600;
const INDENT = 720;

const INK = "1C1B18";
const INK_3 = "8B8981";
const LINE = "E3E1DA";
const CODE_BG = "F3F2EE";
const BLOB = "6D3DF5";
/** The light theme's colours (globals.css): the document is on white paper. */
const COLORS: Record<string, string> = {
  "ink-3": INK_3,
  blob: "5A2BD6",
  sky: "3F78B3",
  teal: "3A8C87",
  moss: "5D8A4C",
  sand: "B48E38",
  clay: "C4653E",
  rose: "C05475",
  plum: "8A5A9C",
};
const CALLOUT_COLORS: Record<string, string> = { idea: BLOB, definition: COLORS.sky, rule: COLORS.sand, example: COLORS.moss, warning: COLORS.clay };

/** `hex` mixed into white, `amount` of it (the highlighter is the colour at 32%). */
function tint(hex: string, amount: number) {
  const n = parseInt(hex, 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * amount);
  return [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}
const highlightFill = (color: unknown) => tint(typeof color === "string" && COLORS[color] ? COLORS[color] : BLOB, color ? 0.32 : 0.22);

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

const BULLET_GLYPHS: Record<string, string> = { disc: "•", circle: "◦", square: "▪", dash: "–", arrow: "→", check: "✓" };
const BY_DEPTH_BULLETS = ["•", "◦", "▪"];
const NUMBER_FORMATS: Record<string, (typeof LevelFormat)[keyof typeof LevelFormat]> = {
  "1": LevelFormat.DECIMAL,
  a: LevelFormat.LOWER_LETTER,
  A: LevelFormat.UPPER_LETTER,
  i: LevelFormat.LOWER_ROMAN,
  I: LevelFormat.UPPER_ROMAN,
};
const BY_DEPTH_NUMBERS = ["1", "a", "i"];

// Converting --------------------------------------------------------------------------------------

type Block = Paragraph | Table;
type JMark = { type: string; attrs?: Record<string, unknown> };
/** Where a block sits: how deep in lists, the list's text size, and a quote or callout around it. */
type Where = { level: number; size: number | null; edge?: { color: string; fill?: string }; bold?: boolean };

const UUID_HREF = /^\/p\/([0-9a-f-]{36})(?:[?#].*)?$/i;

class Converter {
  private lists = new Map<string, { reference: string; levels: ILevelsOptions[] }>();
  private instance = 0;
  private drawing = 0;
  private words;

  constructor(
    private opts: DocxOptions,
    private images: Map<string, DocxImage | null>,
  ) {
    this.words = exportWords(opts.locale);
  }

  numbering() {
    return [...this.lists.values()];
  }

  /** A list's numbering: one per look (marker or number style, and where it starts). */
  private listReference(kind: "bullet" | "number", marker: string | null, start: number) {
    const key = `${kind}:${marker ?? ""}:${start}`;
    let list = this.lists.get(key);
    if (!list) {
      const levels: ILevelsOptions[] = Array.from({ length: 9 }, (_, level) => {
        const indent = { left: INDENT * (level + 1), hanging: 360 };
        if (kind === "bullet") {
          const glyph = marker ? BULLET_GLYPHS[marker] : BY_DEPTH_BULLETS[level % 3];
          return { level, format: LevelFormat.BULLET, text: glyph, alignment: AlignmentType.LEFT, style: { paragraph: { indent } } };
        }
        const format = NUMBER_FORMATS[marker ?? BY_DEPTH_NUMBERS[level % 3]];
        return { level, format, text: `%${level + 1}.`, start: level === 0 ? start : 1, alignment: AlignmentType.LEFT, style: { paragraph: { indent } } };
      });
      list = { reference: `blob-${this.lists.size}`, levels };
      this.lists.set(key, list);
    }
    return list.reference;
  }

  blocks(nodes: JSONContent[] | undefined, where: Where): Block[] {
    return (nodes ?? []).flatMap((n) => this.block(n, where));
  }

  private paragraph(children: ParagraphChild[], where: Where, extra: ConstructorParameters<typeof Paragraph>[0] & object = {}) {
    const edge = where.edge;
    return new Paragraph({
      children,
      ...(where.level > 0 && !("numbering" in extra) && { indent: { left: INDENT * where.level } }),
      ...(edge && {
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: edge.color, space: 8 } },
        ...(edge.fill && { shading: { type: ShadingType.CLEAR, fill: edge.fill, color: "auto" } }),
        indent: { left: INDENT * where.level + 160, right: edge.fill ? 160 : 0 },
      }),
      ...extra,
    });
  }

  private block(node: JSONContent, where: Where): Block[] {
    const w = this.words;
    const align = ALIGN[String(node.attrs?.align)];
    switch (node.type) {
      case "paragraph":
        return [this.paragraph(this.inline(node.content, where), where, { alignment: align })];
      case "heading": {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
        return [this.paragraph(this.inline(node.content, { ...where, size: null }), where, { heading: HEADINGS[level - 1], alignment: align })];
      }
      case "bulletList":
      case "orderedList":
      case "taskList":
        return this.list(node, where);
      case "blockquote":
        return this.blocks(node.content, { ...where, edge: { color: INK_3 } });
      case "codeBlock": {
        const lines = textOf(node).split("\n");
        const runs = lines.map((line, i) => new TextRun({ text: line, font: MONO, size: 20, break: i ? 1 : undefined }));
        return [this.paragraph(runs, where, { shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: "auto" }, spacing: { before: 80, after: 80 } })];
      }
      case "horizontalRule":
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 1 } }, spacing: { after: 200 } })];
      case "image": {
        const img = this.images.get(String(node.attrs?.src ?? ""));
        const alt = String(node.attrs?.alt ?? "");
        if (!img) return alt ? [this.paragraph([new TextRun({ text: alt, italics: true, color: INK_3 })], where)] : [];
        const width = Number(node.attrs?.width) || img.width;
        return [this.paragraph([this.picture(img, width, alt)], where, { alignment: AlignmentType.CENTER })];
      }
      case "table":
        return [this.table(node, where)];
      case "mathBlock": {
        const lines = splitLines(formula(String(node.attrs?.src ?? ""), this.opts.locale));
        return lines.map((line) => this.paragraph([new WordMath({ children: mathRuns(line) })], where, { alignment: AlignmentType.CENTER }));
      }
      case "callout": {
        const kind = Object.hasOwn(w.callout, String(node.attrs?.kind)) ? String(node.attrs?.kind) : "idea";
        const color = CALLOUT_COLORS[kind];
        const inside: Where = { ...where, edge: { color, fill: tint(color, 0.1) } };
        const label = this.paragraph([new TextRun({ text: w.callout[kind as keyof typeof w.callout], bold: true, color })], inside, { spacing: { before: 120 } });
        return [label, ...this.blocks(node.content, inside)];
      }
      case "toggle": {
        const [summary, content] = node.content ?? [];
        return [this.paragraph([new TextRun({ text: "▸ ", color: INK_3 }), ...this.inline(summary?.content, where, { bold: true })], where), ...this.blocks(content?.content, { ...where, level: where.level + 1 })];
      }
      case "flashcard": {
        const [front, back] = node.content ?? [];
        const cell = (label: string, nodes: JSONContent[] | undefined, fill?: string) =>
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: INK_3 })] }), ...this.blocks(nodes, { level: 0, size: null })],
          });
        return [
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [cell(w.question, front?.content, tint(BLOB, 0.08)), cell(w.answer, back?.content)] })] }),
          new Paragraph({ children: [] }),
        ];
      }
      case "diagram":
      case "plot":
      case "sketch": {
        const img = this.opts.drawings[this.drawing++] ?? null;
        if (img) return [this.paragraph([this.picture(img, img.width, node.type)], where, { alignment: AlignmentType.CENTER })];
        if (node.type === "plot") {
          const fns = (Array.isArray(node.attrs?.fns) ? (node.attrs.fns as unknown[]) : []).map(String).filter(Boolean);
          const text = fns.length ? `${w.plot}: ${fns.map((f, i) => `${PLOT_NAMES[i] ?? "f"}(x) = ${f}`).join("; ")}` : w.plot;
          return [this.paragraph([new TextRun({ text, italics: true, color: INK_3 })], where)];
        }
        if (node.type === "diagram") {
          const runs = String(node.attrs?.src ?? "").split("\n").map((line, i) => new TextRun({ text: line, font: MONO, size: 20, break: i ? 1 : undefined }));
          return [this.paragraph(runs, where, { shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: "auto" } })];
        }
        return [this.paragraph([new TextRun({ text: `(${w.sketch})`, italics: true, color: INK_3 })], where)];
      }
      case "file":
        return [this.paragraph([new TextRun({ text: `${w.file}: ${String(node.attrs?.name ?? "")}`, italics: true, color: INK_3 })], where)];
      case "deckEmbed":
        return [this.paragraph(node.attrs?.id ? [this.link(w.deck, this.opts.pageHref(String(node.attrs.id)))] : [new TextRun({ text: w.deck, italics: true })], where)];
      case "lessonLink": {
        const meta = typeof node.attrs?.slug === "string" ? findTopicMeta(node.attrs.slug) : undefined;
        if (!meta) return [this.paragraph([new TextRun({ text: w.lesson, italics: true })], where)];
        return [this.paragraph([this.link(`${w.lesson}: ${resolveText(meta.title, this.opts.locale)}`, this.opts.absolute(topicHref(meta)))], where)];
      }
      case "pageLink": {
        const id = String(node.attrs?.id ?? "");
        const title = String(node.attrs?.title || this.opts.pageTitle?.(id) || w.untitled);
        return [this.paragraph([new TextRun({ text: "↗ ", color: INK_3 }), this.link(title, this.opts.pageHref(id))], where)];
      }
      default: {
        if (node.content?.some((c) => c.type === "text" || c.type === "hardBreak")) return [this.paragraph(this.inline(node.content, where), where)];
        return this.blocks(node.content, where);
      }
    }
  }

  /** Bullets, numbers and checklists, nested lists one level deeper; text under an item lines up with its text. */
  private list(node: JSONContent, where: Where): Block[] {
    const size = typeof node.attrs?.size === "number" ? node.attrs.size : where.size;
    const inner: Where = { ...where, size, level: where.level + 1 };
    const out: Block[] = [];
    if (node.type === "taskList") {
      for (const item of node.content ?? []) {
        const [first, ...rest] = item.content ?? [];
        const box = new CheckBox({ checked: !!item.attrs?.checked });
        const text = first?.type === "paragraph" ? this.inline(first.content, inner, item.attrs?.checked ? { color: INK_3 } : {}) : [];
        out.push(this.paragraph([box, new TextRun({ text: " " }), ...text], { ...where, size, level: where.level }, { indent: { left: INDENT * where.level + 360, hanging: 360 } }));
        if (first && first.type !== "paragraph") out.push(...this.block(first, inner));
        out.push(...this.blocks(rest, inner));
      }
      return out;
    }
    const bullet = node.type === "bulletList";
    const marker = bullet ? (typeof node.attrs?.marker === "string" ? node.attrs.marker : null) : typeof node.attrs?.numbers === "string" ? node.attrs.numbers : null;
    const start = bullet ? 1 : Math.max(0, Number(node.attrs?.start ?? 1) || 1);
    const reference = this.listReference(bullet ? "bullet" : "number", marker, start);
    const instance = ++this.instance;
    const level = Math.min(8, where.level);
    for (const item of node.content ?? []) {
      const [first, ...rest] = item.content ?? [];
      if (first?.type === "paragraph") {
        out.push(this.paragraph(this.inline(first.content, inner), { ...where, size }, { numbering: { reference, level, instance }, alignment: ALIGN[String(first.attrs?.align)] }));
      } else {
        out.push(new Paragraph({ children: [], numbering: { reference, level, instance } }));
        if (first) out.push(...this.block(first, inner));
      }
      out.push(...this.blocks(rest, inner));
    }
    return out;
  }

  private table(node: JSONContent, where: Where): Table {
    const rows = node.content ?? [];
    const widths = (rows[0]?.content ?? []).flatMap((cell) => {
      const span = Number(cell.attrs?.colspan ?? 1) || 1;
      const cw = Array.isArray(cell.attrs?.colwidth) ? (cell.attrs.colwidth as unknown[]) : [];
      return Array.from({ length: span }, (_, i) => (typeof cw[i] === "number" ? (cw[i] as number) : null));
    });
    const known = widths.reduce<number>((sum, x) => sum + (x ?? 0), 0);
    const free = widths.filter((x) => x === null).length;
    const rest = free ? Math.max(72, (PAGE_PX - known) / free) : 0;
    const columns = widths.map((x) => Math.round((x ?? rest) * 15));
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: columns,
      rows: rows.map(
        (row, r) =>
          new TableRow({
            tableHeader: r === 0 && row.content?.some((c) => c.type === "tableHeader"),
            children: (row.content ?? []).map((cell) => {
              const header = cell.type === "tableHeader";
              const children = this.blocks(cell.content, { level: 0, size: where.size, bold: header });
              return new TableCell({
                columnSpan: Number(cell.attrs?.colspan ?? 1) || 1,
                rowSpan: Number(cell.attrs?.rowspan ?? 1) || 1,
                shading: header ? { type: ShadingType.CLEAR, fill: "F4F3EE", color: "auto" } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: children.length ? children : [new Paragraph({ children: [] })],
              });
            }),
          }),
      ),
    });
  }

  private picture(img: DocxImage, width: number, name: string) {
    const w = Math.min(PAGE_PX, Math.max(16, width));
    const h = Math.round((img.height / img.width) * w);
    const transformation = { width: Math.round(w), height: h };
    return new ImageRun({ type: img.type, data: img.data, transformation, altText: { name, description: name, title: name } });
  }

  private link(text: string, href: string, run: IRunOptions = {}) {
    return new ExternalHyperlink({ link: href, children: [new TextRun({ ...run, text, style: "Hyperlink" })] });
  }

  /** Text with its marks, line breaks and formulas in the line. */
  private inline(nodes: JSONContent[] | undefined, where: Where, base: IRunOptions = {}): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    for (const node of nodes ?? []) {
      if (node.type === "hardBreak") {
        out.push(new TextRun({ text: "", break: 1 }));
        continue;
      }
      if (node.type === "mathInline") {
        const lines = splitLines(formula(String(node.attrs?.src ?? ""), this.opts.locale));
        out.push(new WordMath({ children: lines.flatMap((l, i) => (i ? [new MathRun(" "), ...mathRuns(l)] : mathRuns(l))) }));
        continue;
      }
      if (node.type !== "text" || !node.text) {
        const text = textOf(node);
        if (text) out.push(new TextRun({ ...base, text }));
        continue;
      }
      const marks = (node.marks ?? []) as JMark[];
      const run: IRunOptions & { text: string } = { ...base, text: node.text };
      const style = marks.find((m) => m.type === "textStyle")?.attrs;
      const size = typeof style?.size === "number" ? style.size : where.size;
      Object.assign(run, size ? { size: halfPoints(size) } : {});
      if (typeof style?.color === "string" && COLORS[style.color]) Object.assign(run, { color: COLORS[style.color] });
      if (where.bold) Object.assign(run, { bold: true });
      let href: string | null = null;
      for (const m of marks) {
        if (m.type === "bold") Object.assign(run, { bold: true });
        else if (m.type === "italic") Object.assign(run, { italics: true });
        else if (m.type === "underline") Object.assign(run, { underline: {} });
        else if (m.type === "strike") Object.assign(run, { strike: true });
        else if (m.type === "code") Object.assign(run, { font: MONO, shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: "auto" } });
        else if (m.type === "highlight") Object.assign(run, { shading: { type: ShadingType.CLEAR, fill: highlightFill(m.attrs?.color), color: "auto" } });
        else if (m.type === "link" && typeof m.attrs?.href === "string") {
          const page = m.attrs.href.match(UUID_HREF);
          href = page ? this.opts.pageHref(page[1]) : this.opts.absolute(m.attrs.href);
        }
      }
      out.push(href ? this.link(run.text, href, run) : new TextRun(run));
    }
    return out;
  }
}

function textOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mathInline" || node.type === "mathBlock") return String(node.attrs?.src ?? "");
  return (node.content ?? []).map(textOf).join("");
}

// Formulas ----------------------------------------------------------------------------------------

/** A formula as the note draws it (the learning center's display language). */
function formula(src: string, locale: Locale): DNode[] {
  try {
    return parseDisplay(resolveText(toDisplay(src), locale));
  } catch {
    return [{ k: "0", type: "text", v: src }];
  }
}

/** A formula's lines (\\ breaks a line). */
function splitLines(nodes: DNode[]): DNode[][] {
  const lines: DNode[][] = [[]];
  for (const n of nodes) {
    if (n.type === "space" && n.v === "br") lines.push([]);
    else lines[lines.length - 1].push(n);
  }
  return lines.filter((l) => l.length);
}

type MathChild = ConstructorParameters<typeof WordMath>[0]["children"][number];

/** The formula's parts as Word's: fractions, powers, indices and roots stay what they are. */
function mathRuns(nodes: DNode[]): MathChild[] {
  const out: MathChild[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case "frac":
        out.push(new MathFraction({ numerator: mathRuns(n.num), denominator: mathRuns(n.den) }));
        break;
      case "pow":
        out.push(new MathSuperScript({ children: mathRuns(n.base), superScript: mathRuns(n.exp) }));
        break;
      case "sub":
        out.push(new MathSubScript({ children: mathRuns(n.base), subScript: mathRuns(n.sub) }));
        break;
      case "sqrt":
        out.push(new MathRadical({ children: mathRuns(n.body), ...(n.index?.length && { degree: mathRuns(n.index) }) }));
        break;
      case "paren": {
        const children = mathRuns(n.body);
        if (n.open === "(" && n.close === ")") out.push(new MathRoundBrackets({ children }));
        else if (n.open === "[" && n.close === "]") out.push(new MathSquareBrackets({ children }));
        else if (n.open === "{" && n.close === "}") out.push(new MathCurlyBrackets({ children }));
        else if (n.open === "⟨" && n.close === "⟩") out.push(new MathAngledBrackets({ children }));
        else out.push(new MathRun(n.open), ...children, new MathRun(n.close));
        break;
      }
      case "style":
        out.push(...mathRuns(n.body));
        break;
      case "space":
        out.push(new MathRun(" "));
        break;
      default:
        out.push(new MathRun(n.v));
    }
  }
  return out;
}

// The document ------------------------------------------------------------------------------------

function imageSources(nodes: JSONContent[] | undefined, out = new Set<string>()) {
  for (const n of nodes ?? []) {
    if (n.type === "image" && typeof n.attrs?.src === "string" && n.attrs.src) out.add(n.attrs.src);
    imageSources(n.content, out);
  }
  return out;
}

/** The note as a .docx file. */
export async function noteToDocx(doc: JSONContent, opts: DocxOptions): Promise<Blob> {
  const sources = [...imageSources(doc.content)];
  const fetched = await Promise.all(sources.map((src) => opts.image(src).catch(() => null)));
  const converter = new Converter(opts, new Map(sources.map((src, i) => [src, fetched[i]])));
  const body = converter.blocks(doc.content, { level: 0, size: null });
  const heading = (id: string, name: string, size: number, before: number) => ({
    id,
    name,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: FONT, size, bold: true, color: INK },
    paragraph: { spacing: { before, after: 120 }, keepNext: true },
  });
  const document = new Document({
    creator: "Blob",
    title: opts.title,
    styles: {
      default: { document: { run: { font: FONT, size: BASE, color: INK }, paragraph: { spacing: { after: 120, line: 288, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 56, bold: true, color: INK }, paragraph: { spacing: { after: 240 } } },
        heading("Heading1", "Heading 1", 45, 360),
        heading("Heading2", "Heading 2", 35, 280),
        heading("Heading3", "Heading 3", 28, 240),
      ],
      characterStyles: [{ id: "Hyperlink", name: "Hyperlink", basedOn: "DefaultParagraphFont", run: { color: COLORS.blob, underline: {} } }],
    },
    numbering: { config: converter.numbering() },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
        children: [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(opts.title)] }), ...body],
      },
    ],
  });
  return Packer.toBlob(document);
}
