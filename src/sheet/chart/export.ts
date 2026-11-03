// Charts as files: SVG (vector, for reports) and PNG (2× for sharp prints), in light colours.
//
// CONTRACT: keep names and signatures.
//
// The SVG is the same drawing ChartView shows (src/sheet/chart/scene.ts), written out as text
// with fixed colours and named fonts, so it needs no DOM or React: it works in tests and workers.

import type { Locale } from "@/i18n/config";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import type { ChartSpec } from "../types";
import type { ChartData } from "./data";
import { buildChartScene, type SvgNode } from "./scene";

/** Fonts named in exported files (they can't inherit the page's). */
export const EXPORT_FONT = "Geist, Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** React's camelCase attribute names → SVG's (strokeWidth → stroke-width); a few stay camelCase. */
const CAMEL_ATTRS = new Set(["viewBox", "preserveAspectRatio", "clipPathUnits", "gradientUnits", "gradientTransform", "patternUnits"]);
function attrName(k: string): string {
  if (k === "xmlSpace") return "xml:space";
  if (CAMEL_ATTRS.has(k)) return k;
  return k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** One element of a chart scene as SVG text. */
export function svgNodeToString(node: SvgNode | string): string {
  if (typeof node === "string") return esc(node);
  let attrs = "";
  for (const [k, v] of Object.entries(node.attrs ?? {})) {
    if (v === undefined || v === "") continue;
    attrs += ` ${attrName(k)}="${esc(String(v))}"`;
  }
  const kids = (node.children ?? []).map(svgNodeToString).join("");
  return kids ? `<${node.tag}${attrs}>${kids}</${node.tag}>` : `<${node.tag}${attrs}/>`;
}

const sizeOf = (spec: ChartSpec, size?: { w: number; h: number }) => ({
  w: Math.max(120, Math.round(size?.w ?? spec.size.w)),
  h: Math.max(90, Math.round(size?.h ?? spec.size.h)),
});

export function chartSvg(spec: ChartSpec, data: ChartData, locale: Locale, size?: { w: number; h: number }): string {
  const { w, h } = sizeOf(spec, size);
  // Ids unique per chart, so several exported charts can sit in one HTML page.
  const idPrefix = `chart-${spec.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const scene = buildChartScene(spec, data, { width: w, height: h, locale, theme: "light", idPrefix, fontFamily: EXPORT_FONT });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(scene.label)}">` +
    `<title>${esc(scene.title)}</title>` +
    scene.nodes.map(svgNodeToString).join("") +
    `</svg>`
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("chart: the picture didn't load"));
    img.src = src;
  });
}

export async function chartPng(spec: ChartSpec, data: ChartData, locale: Locale, size?: { w: number; h: number }): Promise<Blob> {
  const { w, h } = sizeOf(spec, size);
  const svg = chartSvg(spec, data, locale, { w, h });
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  // Twice the pixels for sharp prints, within what every browser's canvas allows.
  const scale = Math.min(2, 8000 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("chart: no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("chart: no png"))), "image/png"));
}

/** A file name from the chart's title ("Kalibriergerade.png"), or "Diagramm". */
export function chartFileName(spec: Pick<ChartSpec, "title">, locale: Locale): string {
  const base = spec.title
    .replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return base || sheetChartText[locale].fileName;
}

/** Save a file to the Downloads folder (browsers and the apps alike). */
export function downloadFile(name: string, data: Blob) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Render and save a chart as PNG or SVG, named after its title. */
export async function saveChart(spec: ChartSpec, data: ChartData, locale: Locale, format: "png" | "svg"): Promise<void> {
  const name = chartFileName(spec, locale);
  if (format === "svg") {
    downloadFile(`${name}.svg`, new Blob([chartSvg(spec, data, locale)], { type: "image/svg+xml" }));
    return;
  }
  downloadFile(`${name}.png`, await chartPng(spec, data, locale));
}
