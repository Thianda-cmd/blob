"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { useMessages } from "@/i18n/client";
import { inkText } from "@/i18n/messages/ink";
import type { InkDoc } from "@/ink/doc";
import { PAPERS, SHEET_H, SHEET_W, TEMPLATES, type Paper, type Sheet, type Template } from "@/ink/model";
import { drawPaper, drawThing, lookOf, type Images } from "@/ink/render";
import { cn } from "@/lib/utils";

/** A small picture of a template on its paper. */
export function TemplateThumb({ tpl, paper, dark, className }: { tpl: Template; paper: Paper; dark: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d")!;
    // The top of the sheet, a bit enlarged, so the lines can be told apart.
    const s = (w / SHEET_W) * 1.6 * dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawPaper(ctx, tpl, lookOf(paper, dark), 1 / s);
  }, [tpl, paper, dark]);
  return <canvas ref={ref} aria-hidden className={cn("block", className)} />;
}

/** Templates and paper colours, for this page or all of them. */
export function PaperPanel({ sheet, dark, onApply }: { sheet: Sheet | null; dark: boolean; onApply: (style: { tpl?: Template; paper?: Paper }, all: boolean) => void }) {
  const t = useMessages(inkText);
  const [scope, setScope] = useState<"page" | "all">("page");
  const tpl = sheet?.tpl ?? "lined";
  const paper = sheet?.paper ?? "auto";
  const swatch = (p: Paper) => lookOf(p, dark).paper;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t.pageStyle}>
        {TEMPLATES.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === tpl}
            onClick={() => onApply({ tpl: k }, scope === "all")}
            className="group flex flex-col items-center gap-1 text-[11px] leading-tight text-ink-2"
          >
            <span className={cn("relative block overflow-hidden rounded-lg border transition-[box-shadow,border-color]", k === tpl ? "border-blob shadow-[0_0_0_2px_var(--blob-soft)]" : "border-line group-hover:border-line-2")}>
              <TemplateThumb tpl={k} paper={paper} dark={dark} className="h-[72px] w-[54px]" />
              {k === tpl && (
                <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-blob text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="text-center">{t.templates[k]}</span>
          </button>
        ))}
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.paperColour}</div>
        <div className="flex gap-1.5" role="radiogroup" aria-label={t.paperColour}>
          {PAPERS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={p === paper}
              title={t.papers[p]}
              aria-label={t.papers[p]}
              onClick={() => onApply({ paper: p }, scope === "all")}
              className={cn("relative size-9 overflow-hidden rounded-full border border-line transition-[box-shadow]", p === paper && "shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--blob)]")}
              style={{ background: p === "auto" ? `linear-gradient(135deg, ${swatch("white")} 50%, ${lookOf("dark", true).paper} 50%)` : swatch(p) }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-ink-3">{t.applyTo}</span>
        <Segmented
          size="sm"
          label={t.applyTo}
          value={scope}
          onChange={setScope}
          options={[
            { value: "page", label: t.thisPage },
            { value: "all", label: t.allPages },
          ]}
        />
      </div>
    </div>
  );
}

/** A sheet, small, with what is on it (the pages overview). */
export function SheetThumb({ doc, sheet, dark, images, version, className }: { doc: InkDoc; sheet: Sheet; dark: boolean; images: Images | null; version: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    // Drawn when it scrolls into view (a long note has many pages).
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || cancelled) return;
      io.disconnect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(((w * SHEET_H) / SHEET_W) * dpr);
      const ctx = canvas.getContext("2d")!;
      const s = (w / SHEET_W) * dpr;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const look = lookOf(sheet.paper, dark);
      drawPaper(ctx, sheet.tpl, look, 1 / s);
      for (const thing of doc.on(sheet.id)) drawThing(ctx, thing, look.dark, images);
    });
    io.observe(canvas);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [doc, sheet, dark, images, version]);
  return <canvas ref={ref} aria-hidden className={cn("block aspect-[1000/1414] w-full", className)} />;
}
