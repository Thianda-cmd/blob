"use client";

import type { Editor } from "@tiptap/core";
import type { DocxImage } from "@/notes/docx";
import { plainDiagramSvg } from "./blocks/Diagram";
import { standaloneSvg, svgToPng } from "./blocks/DiagramZoom";
import { withLightTheme, type ColorSource } from "./blocks/useDark";

// The pictures of the Word export (src/notes/docx.ts): the note's images, and its diagrams, plots
// and sketches drawn as PNGs, in the light theme whatever the page shows (Word's paper is white).

const RASTER = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" } as const;

async function pngOf(source: CanvasImageSource, width: number, height: number): Promise<Uint8Array | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** A file as a picture the browser can draw (createImageBitmap can't read SVG files). */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    return { source: img, width: img.naturalWidth || 800, height: img.naturalHeight || 600, done: () => {} };
  }
}

/** A picture of the note, fetched; kinds Word can't show (WebP, SVG…) become PNGs. */
export async function docxImage(src: string): Promise<DocxImage | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const file = await res.blob();
    const { source, width, height, done } = await decode(file);
    const type = RASTER[file.type as keyof typeof RASTER];
    const data = type ? new Uint8Array(await file.arrayBuffer()) : await pngOf(source, width, height);
    done();
    return data ? { data, type: type ?? "png", width, height } : null;
  } catch {
    return null;
  }
}

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "visibility",
];

/** A drawing on the page as an SVG file of its own: the page's CSS written onto each part. */
function liveSvg(svg: SVGSVGElement): string {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  from.forEach((el, i) => {
    const css = getComputedStyle(el);
    to[i]?.setAttribute("style", STYLE_PROPS.map((p) => `${p}:${css.getPropertyValue(p)}`).join(";"));
  });
  if (!copy.getAttribute("viewBox")) {
    const box = svg.getBoundingClientRect();
    copy.setAttribute("viewBox", `0 0 ${Math.round(box.width) || 800} ${Math.round(box.height) || 600}`);
  }
  return copy.outerHTML;
}

/** The biggest drawing in a block (its toolbar's icons are drawings too). */
function mainSvg(dom: Node | null): SVGSVGElement | null {
  if (!(dom instanceof Element)) return null;
  let best: SVGSVGElement | null = null;
  let area = 0;
  for (const svg of dom.querySelectorAll<SVGSVGElement>("svg:not(.lucide)")) {
    const box = svg.getBoundingClientRect();
    const a = box.width * box.height;
    if (a > area) [best, area] = [svg, a];
  }
  return best;
}

async function drawingPng(svg: string | null, color: ColorSource): Promise<DocxImage | null> {
  if (!svg) return null;
  const file = await standaloneSvg(svg, color);
  if (!file) return null;
  const png = await svgToPng(file);
  return { data: new Uint8Array(await png.arrayBuffer()), type: "png", width: Math.round(file.w), height: Math.round(file.h) };
}

/**
 * The note's diagrams, plots and sketches as pictures, in the order they come in it. Diagrams are
 * drawn again; plots and sketches are copied from the page into the light theme's corner.
 */
export function docxDrawings(editor: Editor): Promise<(DocxImage | null)[]> {
  return withLightTheme(({ color, host }) => {
    host.className = editor.view.dom.className;
    host.style.width = `${editor.view.dom.getBoundingClientRect().width}px`;
    const jobs: Promise<DocxImage | null>[] = [];
    editor.state.doc.descendants((node, pos) => {
      const name = node.type.name;
      if (name !== "diagram" && name !== "plot" && name !== "sketch") return;
      let job: Promise<DocxImage | null>;
      if (name === "diagram") {
        job = plainDiagramSvg(String(node.attrs.src ?? ""), color).then((svg) => drawingPng(svg, color));
      } else {
        const dom = editor.view.nodeDOM(pos);
        const copy = dom instanceof Element ? (dom.cloneNode(true) as Element) : null;
        if (copy) host.appendChild(copy);
        const svg = mainSvg(copy);
        job = drawingPng(svg ? liveSvg(svg) : null, color);
      }
      jobs.push(job.catch(() => null));
    });
    return Promise.all(jobs);
  });
}
