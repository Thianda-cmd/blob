"use client";

// A note as a PDF: a clean copy of the note (title, then the text with every block as it looks on
// screen, drawn in the light theme) is all the paper shows, and the browser's print window turns it
// into a PDF ("Save as PDF"). Closed toggles open and flashcards show both sides on paper.

const PRINT_CSS = `
@page { size: A4; margin: 16mm 15mm 18mm; }
@media print {
  html.note-printing, html.note-printing body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  html.note-printing body > :not(.note-print) { display: none !important; }
  html.note-printing .note-print { position: static !important; left: auto !important; visibility: visible !important; width: auto !important; }
}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  copy.querySelectorAll(".collab-caret, .ProseMirror-gapcursor, .blob-upload, .ProseMirror-separator").forEach((el) => el.remove());
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

/**
 * Prints the note (the print window, where "Save as PDF" makes the file). `dom` is the editor's
 * text; the PDF is named after the title. Resolves once the print window has closed.
 */
export async function printNote({ dom, title, icon, untitled }: { dom: HTMLElement; title: string; icon: string | null; untitled: string }) {
  const root = document.documentElement;
  const theme = root.dataset.theme;
  // Paper is white: drawings made for the dark theme are drawn again in the light one first.
  if (theme === "dark") {
    root.dataset.theme = "light";
    await wait(900);
  }

  const box = document.createElement("div");
  box.className = "note-print";
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
