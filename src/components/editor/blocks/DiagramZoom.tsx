"use client";

import { Download, Minus, Plus, Scan, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { themeColor, type ColorSource } from "./useDark";

// A diagram opened large (zoom and pan), and diagrams as files: SVG and PNG.

/** The drawing's own size, from its viewBox. */
function svgSize(svg: string): { x: number; y: number; w: number; h: number } {
  const m = svg.match(/viewBox="\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([\d.e]+)[\s,]+([\d.e]+)\s*"/i);
  const [x, y, w, h] = m ? m.slice(1).map(Number) : [0, 0, 800, 600];
  return { x, y, w: w > 0 ? w : 800, h: h > 0 ? h : 600 };
}

export type DiagramFormat = "svg" | "png";

/** `color-mix(…)` and other CSS colours as "#rrggbb" (what a canvas makes of them), or null. */
function cssColor(expr: string, ctx: CanvasRenderingContext2D): string | null {
  ctx.fillStyle = "#010203";
  ctx.fillStyle = expr;
  const out = String(ctx.fillStyle);
  return out === "#010203" && !/^#010203$/i.test(expr) ? null : out;
}

/** The page's colours written into CSS, so the drawing looks the same outside the page. */
function resolveCss(css: string, ctx: CanvasRenderingContext2D, color: ColorSource): string {
  let out = css.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (m, name: string, fallback?: string) => color(name, fallback?.trim() ?? m));
  // color-mix() has brackets inside: find each one's end by counting them.
  for (let at = out.indexOf("color-mix("); at >= 0; at = out.indexOf("color-mix(", at + 1)) {
    let depth = 0;
    let end = at + "color-mix".length;
    for (; end < out.length; end++) {
      if (out[end] === "(") depth++;
      else if (out[end] === ")" && --depth === 0) break;
    }
    const expr = out.slice(at, end + 1);
    const resolved = cssColor(expr, ctx);
    if (resolved) out = out.slice(0, at) + resolved + out.slice(end + 1);
  }
  return out;
}

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * The page's font (the first in `family`) as @font-face rules with the files inside: a drawing
 * outside the page would fall back to another font, and its labels no longer fit their boxes.
 */
async function embeddedFont(family: string): Promise<string> {
  const name = family.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  if (!name) return "";
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSFontFaceRule && rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim() === name) rules.push(rule);
    }
  }
  const faces = await Promise.all(
    rules.slice(0, 6).map(async (rule) => {
      const url = rule.style.getPropertyValue("src").match(/url\(\s*["']?([^"')]+)["']?\s*\)/)?.[1];
      if (!url) return "";
      try {
        const res = await fetch(new URL(url, location.href));
        const data = res.ok ? await res.arrayBuffer() : null;
        if (!data || data.byteLength > 400_000) return "";
        const range = rule.style.getPropertyValue("unicode-range");
        return `@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${base64(data)}) format("woff2");font-weight:${rule.style.getPropertyValue("font-weight") || "normal"};font-style:${rule.style.getPropertyValue("font-style") || "normal"};${range ? `unicode-range:${range};` : ""}}`;
      } catch {
        return "";
      }
    }),
  );
  return faces.join("");
}

/**
 * The drawing as a file of its own: real colours instead of the page's variables, the page's
 * background behind it (dark diagrams stay readable on white paper), its font inside, its own size.
 * `color`: where the colours come from (the light theme's for the Word export).
 */
export async function standaloneSvg(svg: string, color: ColorSource = themeColor): Promise<{ text: string; w: number; h: number } | null> {
  const root = new DOMParser().parseFromString(svg, "text/html").body.querySelector("svg");
  if (!root) return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const { x, y, w, h } = svgSize(svg);
  root.removeAttribute("style");
  root.setAttribute("width", String(Math.ceil(w)));
  root.setAttribute("height", String(Math.ceil(h)));
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const styles = root.querySelectorAll("style");
  styles.forEach((s) => {
    s.textContent = resolveCss(s.textContent ?? "", ctx, color);
  });
  const family = (styles[0]?.textContent ?? "").match(/font-family:\s*([^;}]+)/)?.[1] ?? getComputedStyle(document.body).fontFamily;
  const font = await embeddedFont(family);
  if (font && styles[0]) styles[0].textContent = font + styles[0].textContent;
  for (const el of root.querySelectorAll("[style], [fill], [stroke]")) {
    for (const name of ["style", "fill", "stroke"]) {
      const v = el.getAttribute(name);
      if (v && /var\(|color-mix\(/.test(v)) el.setAttribute(name, resolveCss(v, ctx, color));
    }
  }
  const bg = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", color("--raised", "#ffffff"));
  root.insertBefore(bg, root.firstChild);
  return { text: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(root)}`, w, h };
}

/** The file drawn on a canvas, twice as sharp as on screen (at most 4096 pixels a side). */
export async function svgToPng(file: { text: string; w: number; h: number }): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.text)}`;
  await img.decode();
  const scale = Math.min(2, 4096 / Math.max(file.w, file.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(file.w * scale));
  canvas.height = Math.max(1, Math.round(file.h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Throws when the browser counts the picture as foreign (some do for HTML inside SVG).
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no png"))), "image/png"));
}

function saveFile(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** A file name from the diagram's title. */
export function diagramFileName(title: string, fallback: string) {
  const base = title.replace(/[\\/:*?"<>|#%]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return base || fallback;
}

/**
 * Download the drawing. `plain` draws it again without HTML labels, for browsers that won't turn
 * a drawing with them into a PNG.
 */
export async function downloadDiagram(svg: string, format: DiagramFormat, name: string, plain: () => Promise<string | null>) {
  const file = await standaloneSvg(svg);
  if (!file) throw new Error("no drawing");
  if (format === "svg") {
    saveFile(new Blob([file.text], { type: "image/svg+xml" }), `${name}.svg`);
    return;
  }
  let png: Blob;
  try {
    png = await svgToPng(file);
  } catch {
    const again = await plain();
    const other = again ? await standaloneSvg(again) : null;
    if (!other) throw new Error("no drawing");
    png = await svgToPng(other);
  }
  saveFile(png, `${name}.png`);
}

type View = { x: number; y: number; s: number };
const MIN = 0.1;
const MAX = 8;

/** The diagram on the whole screen: drag to move, scroll or pinch to zoom, Escape closes. */
export function DiagramViewer({ svg, title, onClose, onDownload }: { svg: string; title: string; onClose: () => void; onDownload: (format: DiagramFormat) => void }) {
  const t = useMessages(noteBlocksText).diagram;
  const stage = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const size = useMemo(() => svgSize(svg), [svg]);
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const fit = useCallback(() => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    const s = Math.max(MIN, Math.min(MAX, Math.min(r.width / size.w, r.height / size.h) * 0.92));
    setView({ s, x: (r.width - size.w * s) / 2, y: (r.height - size.h * s) / 2 });
  }, [size]);
  // Fit once the stage has its size.
  useLayoutEffect(fit, [fit]);

  /** Zoom by `factor` around a point of the stage (its middle by default). */
  const zoom = useCallback((factor: number, cx?: number, cy?: number) => {
    const r = stage.current?.getBoundingClientRect();
    setView((v) => {
      const s = Math.max(MIN, Math.min(MAX, v.s * factor));
      const px = cx ?? (r ? r.width / 2 : 0);
      const py = cy ?? (r ? r.height / 2 : 0);
      return { s, x: px - (px - v.x) * (s / v.s), y: py - (py - v.y) * (s / v.s) };
    });
  }, []);

  // Keys, the wheel (not passive: the page must not scroll) and focus while open.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "+" || e.key === "=") zoom(1.25);
      else if (e.key === "-") zoom(0.8);
      else if (e.key === "0") fit();
    };
    const el = stage.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    window.addEventListener("keydown", onKey, true);
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      el?.removeEventListener("wheel", onWheel);
      before?.focus?.({ preventScroll: true });
    };
  }, [onClose, zoom, fit]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const all = pointers.current;
    const prev = all.get(e.pointerId);
    if (!prev) return;
    const others = [...all.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    all.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (others.length === 0) {
      setView((v) => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
      return;
    }
    // Two fingers: zoom by how much further apart they are, around the point between them.
    const o = others[0];
    const before = Math.hypot(prev.x - o.x, prev.y - o.y);
    const after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
    const r = stage.current!.getBoundingClientRect();
    if (before > 0) zoom(after / before, (e.clientX + o.x) / 2 - r.left, (e.clientY + o.y) / 2 - r.top);
    setView((v) => ({ ...v, x: v.x + (e.clientX - prev.x) / 2, y: v.y + (e.clientY - prev.y) / 2 }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="blob-dv" role="dialog" aria-modal="true" aria-label={title || t.viewer}>
      <div className="blob-dv-bar">
        <span className="blob-dv-title">{title || t.viewer}</span>
        <div className="blob-dv-tools">
          <button type="button" className="blob-dv-tool" onClick={() => zoom(0.8)} aria-label={t.zoomOut} title={t.zoomOut}>
            <Minus className="size-4" />
          </button>
          <button type="button" className="blob-dv-tool is-pct" onClick={fit} title={t.fit}>
            {Math.round(view.s * 100)}%
          </button>
          <button type="button" className="blob-dv-tool" onClick={() => zoom(1.25)} aria-label={t.zoomIn} title={t.zoomIn}>
            <Plus className="size-4" />
          </button>
          <button type="button" className="blob-dv-tool" onClick={fit} aria-label={t.fit} title={t.fit}>
            <Scan className="size-4" />
          </button>
          <span className="blob-dv-sep" aria-hidden />
          <button type="button" className="blob-dv-tool is-text" onClick={() => onDownload("svg")} title={`${t.download}: ${t.svgHint}`}>
            <Download className="size-4" />
            {t.svg}
          </button>
          <button type="button" className="blob-dv-tool is-text" onClick={() => onDownload("png")} title={`${t.download}: ${t.pngHint}`}>
            <Download className="size-4" />
            {t.png}
          </button>
          <span className="blob-dv-sep" aria-hidden />
          <button ref={closeRef} type="button" className="blob-dv-tool" onClick={onClose} aria-label={t.close} title={t.close}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div ref={stage} className="blob-dv-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={() => zoom(1.6)}>
        <div
          className="blob-dv-paper"
          style={{ width: size.w, height: size.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <p className="blob-dv-hint">{t.zoomHint}</p>
    </div>,
    document.body,
  );
}
