"use client";

// A note as a PDF: a clean copy of the note (title, then the text with every block as it looks on
// screen, drawn in the light theme) is all the paper shows, and the browser's print window turns it
// into a PDF ("Save as PDF"). Closed toggles open and flashcards show both sides on paper.

/** The paper: A4, and its margins (mm). */
const PAGE = { width: 210, top: 16, side: 15, bottom: 18 };
/** The width the note has on paper, in CSS px (96 per inch): about 680. */
const PAPER_WIDTH = Math.floor(((PAGE.width - 2 * PAGE.side) / 25.4) * 96);

const PRINT_CSS = `
@page { size: A4; margin: ${PAGE.top}mm ${PAGE.side}mm ${PAGE.bottom}mm; }
@media print {
  html.note-printing, html.note-printing body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  html.note-printing body > :not(.note-print) { display: none !important; }
  html.note-printing .note-print { position: static !important; left: auto !important; visibility: visible !important; width: auto !important; }
}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Marks only the screen needs, for editing: what is selected (a block's purple ring, a picture, a
 * line, a formula, a link to a page, table cells), the find bar's matches, other people's
 * selections, the hints in empty lines ("Überschrift 1") and what is typed after "/" or "[[" while
 * its menu is open (grey, with "Tippen zum Filtern…").
 */
const SCREEN_MARKS = ["blob-node-selected", "ProseMirror-selectednode", "is-selected", "selectedCell", "blob-find-match", "collab-selection", "is-empty", "is-editor-empty", "blob-slash-query", "is-query-empty"];

/**
 * Blocks that are still loading (a spreadsheet block's view or its data mark themselves with
 * data-print-wait) have their content: the copy shows what the screen shows then. At most a few
 * seconds; a block that takes longer is printed as it is.
 */
async function loaded(dom: HTMLElement) {
  const until = Date.now() + 8000;
  while (dom.querySelector("[data-print-wait]") && Date.now() < until) await wait(100);
}

/** Pictures, diagrams and fonts ready (or a few seconds passed). */
async function settled(root: HTMLElement) {
  const images = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  await Promise.race([Promise.all(images.map((img) => new Promise((r) => ((img.onload = r), (img.onerror = r))))), wait(4000)]);
  await document.fonts?.ready;
}

/** The note's text as it is on screen, made still: no editing, fields shown as their text, drawings as pictures. */
function stillCopy(dom: HTMLElement) {
  const copy = dom.cloneNode(true) as HTMLElement;
  copy.removeAttribute("contenteditable");
  copy.classList.remove("ProseMirror-focused", "has-blob-caret");
  copy.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  // Helpers only the screen has: carets (other people's, and the one between blocks), uploads on
  // their way, the purple bar on a table's column edge under the mouse, ProseMirror's line ends.
  // None of them holds a canvas or a field, so those below still pair up with the screen's.
  copy.querySelectorAll(".collab-caret, .ProseMirror-gapcursor, .blob-upload, .blob-file-uploading, .column-resize-handle, .ProseMirror-separator").forEach((el) => el.remove());
  // Paper shows none of them: a chart block that "In Notiz einfügen" just added is still selected,
  // and so is the first block of a note that starts with one, right after it opens.
  copy.querySelectorAll(SCREEN_MARKS.map((mark) => `.${mark}`).join(", ")).forEach((el) => el.classList.remove(...SCREEN_MARKS));
  // Canvases lose their drawing when copied: they come along as pictures.
  const canvases = dom.querySelectorAll("canvas");
  copy.querySelectorAll("canvas").forEach((c, i) => {
    try {
      const img = document.createElement("img");
      img.src = canvases[i].toDataURL("image/png");
      img.style.width = `${canvases[i].clientWidth}px`;
      img.style.maxWidth = "100%";
      c.replaceWith(img);
    } catch {
      c.remove();
    }
  });
  // Drawings (diagrams) refer to their own parts by id (arrowheads, styles): the copy gets ids of
  // its own, or it would point at the original, which isn't printed.
  copy.querySelectorAll("svg").forEach((svg) => {
    const ids = [...svg.querySelectorAll("[id]")].map((el) => el.id);
    if (svg.id) ids.push(svg.id);
    if (!ids.length) return;
    let html = svg.outerHTML;
    for (const id of ids) {
      const safe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`(id="|#)${safe}(?![\\w-])`, "g"), `$1${id}-print`);
    }
    const holder = document.createElement("div");
    holder.innerHTML = html;
    if (holder.firstElementChild) svg.replaceWith(holder.firstElementChild);
  });
  // Checkboxes keep their state; other fields become their text.
  const fields = dom.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  copy.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((f, i) => {
    const original = fields[i];
    if (f instanceof HTMLInputElement && (f.type === "checkbox" || f.type === "radio")) {
      if ((original as HTMLInputElement).checked) f.setAttribute("checked", "");
      else f.removeAttribute("checked");
      return;
    }
    const span = document.createElement("span");
    span.className = "note-print-field";
    span.textContent = original?.value ?? "";
    f.replaceWith(span);
  });
  return copy;
}

/** The smallest text a table from a spreadsheet gets on paper, in px (about 5.6 pt: still easy to read). */
const MIN_TABLE_FONT = 7.5;
/** A cell's text wider than this (in em) wraps on paper, as in a cell set to wrap (sheetEmbed.css, .is-wrap). */
const LONG_TEXT = 22;

/**
 * How a table wider than the paper prints, from its columns' widths (px, at its own text size) and
 * the room it has: its text first gets smaller, down to `min` (a share of its size); if it still
 * doesn't fit then, it prints in pieces one below the other, as Excel prints a wide sheet ("down,
 * then over"): as few pieces as that smallest text allows, with the largest text that still needs
 * no more of them. Each piece starts with the first column again (`lead`: it names the rows),
 * unless that column takes much of the room. `parts` are the columns of each piece.
 */
export function planWideTable(widths: number[], room: number, min: number): { scale: number; parts: number[][]; lead: boolean } {
  const all = widths.map((_, i) => i);
  const total = widths.reduce((sum, w) => sum + w, 0);
  if (total <= room) return { scale: 1, parts: [all], lead: false };
  if (total * min <= room) return { scale: room / total, parts: [all], lead: false };
  const lead = widths.length > 2 && widths[0] * min <= room / 3;
  const pack = (scale: number) => {
    const first = lead ? widths[0] * scale : 0;
    const parts: number[][] = [];
    let part: number[] = [];
    let used = first;
    for (let i = lead ? 1 : 0; i < widths.length; i++) {
      const w = widths[i] * scale;
      if (part.length && used + w > room) {
        parts.push(part);
        part = [];
        used = first;
      }
      part.push(i);
      used += w;
    }
    parts.push(part);
    return lead ? parts.map((p) => [0, ...p]) : parts;
  };
  const fewest = pack(min).length;
  if (pack(1).length <= fewest) return { scale: 1, parts: pack(1), lead };
  let lo = min;
  let hi = 1;
  for (let step = 0; step < 24; step++) {
    const mid = (lo + hi) / 2;
    if (pack(mid).length <= fewest) lo = mid;
    else hi = mid;
  }
  return { scale: lo, parts: pack(lo), lead };
}

const widthOf = (el: Element) => el.getBoundingClientRect().width;

/** The table as pieces with these columns each (a table from a spreadsheet has one cell per column in every row). */
function splitTable(table: HTMLTableElement, parts: number[][], lead: boolean) {
  const pieces = parts.map((cols) => {
    const keep = new Set(cols);
    const piece = table.cloneNode(true) as HTMLTableElement;
    for (const row of [...piece.rows]) [...row.cells].forEach((cell, i) => keep.has(i) || cell.remove());
    piece.classList.add("is-piece");
    if (lead) piece.classList.add("has-lead");
    return piece;
  });
  table.replaceWith(...pieces);
  return pieces;
}

/**
 * Tables from a spreadsheet wider than the paper (on screen they scroll sideways; paper would cut
 * them off at its edge, without a word): a long text wraps, the text gets smaller, and a table that
 * still doesn't fit prints in pieces (planWideTable). `box` is the print copy, laid out as wide as
 * the paper. Tables that fit stay as they are.
 */
function fitWideTables(box: HTMLElement) {
  for (const table of box.querySelectorAll<HTMLTableElement>(".blob-sheet-scroll > table.blob-sheet-table")) {
    const holder = table.parentElement as HTMLElement;
    const style = getComputedStyle(holder);
    const room = widthOf(holder) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // (Half a pixel of rounding is no overflow: a table set to full width is exactly as wide as its room.)
    const tooWide = (el: Element) => widthOf(el) > room + 0.5;
    if (room <= 0 || !tooWide(table)) continue;
    const font = parseFloat(getComputedStyle(table).fontSize);
    const long = [...table.querySelectorAll("td, th")].filter((cell) => widthOf(cell) > LONG_TEXT * font);
    long.forEach((cell) => cell.classList.add("is-wrap"));
    if (!tooWide(table)) continue;
    const widths = [...(table.rows[0]?.cells ?? [])].map(widthOf);
    const plan = planWideTable(widths, room, Math.min(1, MIN_TABLE_FONT / font));
    const pieces = plan.parts.length > 1 ? splitTable(table, plan.parts, plan.lead) : [table];
    // Borders don't get smaller with the text: a piece still a hair too wide gets its text a hair smaller.
    let size = font * plan.scale;
    for (let step = 0; step < 3; step++) {
      pieces.forEach((piece) => piece.style.setProperty("--blob-sheet-font", `${size.toFixed(2)}px`));
      const near = pieces
        .filter(tooWide)
        .map((piece) => widthOf(piece) / room)
        .filter((r) => r < 1.05);
      if (!near.length) break;
      size /= Math.max(...near) * 1.002;
    }
    // Still too wide (a word longer than the paper is wide): its text breaks where it has to.
    for (const piece of pieces) if (tooWide(piece)) piece.classList.add("is-squeezed");
  }
}

/**
 * Prints the note (the print window, where "Save as PDF" makes the file). `dom` is the editor's
 * text; the PDF is named after the title. Resolves once the print window has closed.
 */
export async function printNote({ dom, title, icon, untitled }: { dom: HTMLElement; title: string; icon: string | null; untitled: string }) {
  await loaded(dom);
  const root = document.documentElement;
  const theme = root.dataset.theme;
  // Paper is white: drawings made for the dark theme are drawn again in the light one first.
  if (theme === "dark") {
    root.dataset.theme = "light";
    await wait(900);
  }

  const box = document.createElement("div");
  box.className = "note-print";
  // Laid out as wide as the paper, so what is measured below is what prints.
  box.style.width = `${PAPER_WIDTH}px`;
  box.setAttribute("aria-hidden", "true");
  const style = document.createElement("style");
  style.textContent = PRINT_CSS;
  const header = document.createElement("header");
  header.className = "note-print-header";
  if (icon && !icon.startsWith("http")) {
    const i = document.createElement("div");
    i.className = "note-print-icon";
    i.textContent = icon;
    header.append(i);
  }
  const h1 = document.createElement("h1");
  h1.className = "note-print-title";
  h1.textContent = title || untitled;
  header.append(h1);
  box.append(style, header, stillCopy(dom));
  document.body.append(box);

  const docTitle = document.title;
  document.title = title || untitled;
  root.classList.add("note-printing");
  await settled(box);
  fitWideTables(box);

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pointerdown", finish);
      root.classList.remove("note-printing");
      box.remove();
      document.title = docTitle;
      if (theme === "dark") root.dataset.theme = "dark";
      resolve();
    };
    window.addEventListener("afterprint", finish, { once: true });
    window.print();
    // Some browsers return from print() while the window is still open and never send afterprint:
    // the next tap or click in the page means it has closed.
    window.addEventListener("pointerdown", finish, { once: true });
  });
}
