"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { useMessages } from "@/i18n/client";
import { inkText } from "@/i18n/messages/ink";
import type { Settings } from "@/ink/engine";
import { INK, type InkColor, type PenTool, type Stroke } from "@/ink/model";
import { HIGHLIGHTER_COLORS, PEN_COLORS, PENS, StrokeBuilder } from "@/ink/pens";
import { drawStroke, inkColor } from "@/ink/render";
import { boxOfPoints } from "@/ink/engine";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./ColorPicker";
import { PEN_ICONS } from "./icons";

type Update = (fn: (s: Settings) => Settings) => void;

/** A sample line drawn with the pen as it is set (pressure rising and falling, like a real stroke). */
export function PenSample({ tool, size, color, dark, className }: { tool: PenTool; size: number; color: InkColor; dark: boolean; className?: string }) {
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
    // About the size it writes on screen: 1.2 pixels per unit.
    const scale = 1.2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const uw = w / scale;
    const uh = h / scale;
    const b = new StrokeBuilder(tool, size, "pen", scale);
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = 14 + t * (uw - 28);
      const y = uh / 2 + Math.sin(t * Math.PI * 2.2) * Math.min(uh * 0.26, 14);
      const pressure = 0.25 + 0.6 * Math.sin(t * Math.PI);
      b.add(x, y, pressure, i * 8);
    }
    const p = b.finish();
    const stroke: Stroke = { kind: "stroke", id: "sample", sheet: "sample", seq: 0, tool, color, size, opacity: tool === "pencil" ? 0.85 : 1, shape: null, ...p, box: boxOfPoints(p.xs, p.ys, p.ws) };
    ctx.clearRect(0, 0, uw, uh);
    drawStroke(ctx, stroke, dark);
  }, [tool, size, color, dark]);
  return <canvas ref={ref} aria-hidden className={cn("block h-11 w-full", className)} />;
}

function SizeSlider({ tool, value, onChange, label }: { tool: PenTool; value: number; onChange: (v: number) => void; label: string }) {
  const spec = PENS[tool];
  return (
    <label className="flex items-center gap-3 text-[12.5px] text-ink-3">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 flex-1 cursor-pointer accent-[var(--blob)]"
        aria-label={label}
      />
      <span className="w-8 shrink-0 text-right tabular-nums text-ink-2">{Math.round(value * 10) / 10}</span>
    </label>
  );
}

/** Colour swatches, the custom picker and the recent custom colours. */
function Colors({
  colors,
  value,
  onPick,
  dark,
  recent,
  remember,
}: {
  colors: InkColor[];
  value: InkColor;
  onPick: (c: InkColor) => void;
  dark: boolean;
  recent: InkColor[];
  remember: (c: InkColor) => void;
}) {
  const t = useMessages(inkText);
  const [custom, setCustom] = useState(false);
  const extra = recent.filter((c) => !colors.includes(c)).slice(0, 6);
  const swatch = (c: InkColor) => (
    <button
      key={c}
      type="button"
      role="radio"
      aria-checked={c === value}
      aria-label={c === INK ? t.colour : c}
      title={c === INK ? t.colour : c}
      onClick={() => {
        onPick(c);
        setCustom(false);
      }}
      className="grid size-9 place-items-center rounded-full transition-transform active:scale-90"
    >
      <span
        className={cn("block size-6 rounded-full border border-black/10 dark:border-white/15", c === value && "shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--blob)]")}
        style={{ background: inkColor(c, dark) }}
      />
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.colour}</div>
      <div className="grid grid-cols-7 gap-0.5" role="radiogroup" aria-label={t.colour}>
        {colors.map(swatch)}
        <button
          type="button"
          aria-label={t.customColour}
          title={t.customColour}
          aria-expanded={custom}
          onClick={() => setCustom((v) => !v)}
          className="grid size-9 place-items-center rounded-full"
        >
          <span className={cn("grid size-6 place-items-center rounded-full text-white", custom && "shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--blob)]")} style={{ background: "conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)" }}>
            <Plus className="size-3.5 drop-shadow" strokeWidth={3} />
          </span>
        </button>
      </div>
      {extra.length > 0 && (
        <>
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.recent}</div>
          <div className="flex flex-wrap gap-0.5" role="radiogroup" aria-label={t.recent}>
            {extra.map(swatch)}
          </div>
        </>
      )}
      {custom && (
        <ColorPicker
          value={value.startsWith("#") ? value : "#2563eb"}
          onChange={(hex) => {
            onPick(hex);
            remember(hex);
          }}
          labels={{ hex: t.hex, colour: t.customColour }}
        />
      )}
    </div>
  );
}

/** Pens: which one, how thick, which colour. */
export function PenPanel({
  settings,
  update,
  dark,
  recent,
  remember,
  only,
  onPick,
}: {
  settings: Settings;
  update: Update;
  dark: boolean;
  recent: InkColor[];
  remember: (c: InkColor) => void;
  only?: "colors";
  onPick?: (c: InkColor) => void;
}) {
  const t = useMessages(inkText);
  const tool: PenTool = settings.tool === "pen" || settings.tool === "fountain" || settings.tool === "pencil" || settings.tool === "calligraphy" ? settings.tool : "pen";
  const pen = settings.pens[tool];
  const setPen = (patch: Partial<typeof pen>) => update((s) => ({ ...s, pens: { ...s.pens, [tool]: { ...s.pens[tool], ...patch } } }));
  const pick = onPick ?? ((c: InkColor) => setPen({ color: c }));
  if (only === "colors") return <Colors colors={PEN_COLORS} value={pen.color} onPick={pick} dark={dark} recent={recent} remember={remember} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t.pen}>
        {(["pen", "fountain", "pencil", "calligraphy"] as const).map((k) => {
          const Icon = PEN_ICONS[k];
          const on = k === tool;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update((s) => ({ ...s, tool: k }))}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 pb-1.5 pt-2 text-[11px] leading-tight transition-colors",
                on ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:border-line-2 hover:bg-hover/60",
              )}
            >
              <Icon className="size-5" style={{ color: inkColor(settings.pens[k].color, dark) }} />
              <span className="text-center">{t.pens[k]}</span>
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-line bg-surface">
        <PenSample tool={tool} size={pen.size} color={pen.color} dark={dark} />
      </div>
      <SizeSlider tool={tool} value={pen.size} onChange={(size) => setPen({ size })} label={t.size} />
      <Colors colors={PEN_COLORS} value={pen.color} onPick={pick} dark={dark} recent={recent} remember={remember} />
    </div>
  );
}

export function HighlighterPanel({ settings, update, recent, remember, only }: { settings: Settings; update: Update; recent: InkColor[]; remember: (c: InkColor) => void; only?: "colors" }) {
  const t = useMessages(inkText);
  const pen = settings.pens.highlighter;
  const setPen = (patch: Partial<typeof pen>) => update((s) => ({ ...s, tool: "highlighter", pens: { ...s.pens, highlighter: { ...s.pens.highlighter, ...patch } } }));
  const colors = <Colors colors={HIGHLIGHTER_COLORS} value={pen.color} onPick={(c) => setPen({ color: c })} dark={false} recent={recent} remember={remember} />;
  if (only === "colors") return colors;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-line bg-surface">
        <PenSample tool="highlighter" size={pen.size} color={pen.color} dark={false} />
      </div>
      <SizeSlider tool="highlighter" value={pen.size} onChange={(size) => setPen({ size })} label={t.size} />
      {colors}
    </div>
  );
}

export function EraserPanel({ settings, update, close }: { settings: Settings; update: Update; close: () => void }) {
  const t = useMessages(inkText);
  const e = settings.eraser;
  const set = (patch: Partial<typeof e>) => update((s) => ({ ...s, eraser: { ...s.eraser, ...patch } }));
  void close;
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t.eraserMode}
        value={e.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "stroke", label: t.eraseWhole },
          { value: "area", label: t.eraseArea },
        ]}
        className="w-full [&>button]:flex-1"
      />
      <label className="flex items-center gap-3 text-[12.5px] text-ink-3">
        <span className="w-12 shrink-0">{t.size}</span>
        <input type="range" min={4} max={60} step={1} value={e.size} onChange={(ev) => set({ size: Number(ev.target.value) })} className="h-6 flex-1 cursor-pointer accent-[var(--blob)]" aria-label={t.size} />
        <span className="grid size-8 shrink-0 place-items-center">
          <span className="block rounded-full border border-ink-3/60 bg-hover" style={{ width: Math.min(32, e.size), height: Math.min(32, e.size) }} />
        </span>
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-ink-2">
        {t.highlighterOnly}
        <input type="checkbox" checked={e.highlighterOnly} onChange={(ev) => set({ highlighterOnly: ev.target.checked })} className="size-4 cursor-pointer accent-[var(--blob)]" />
      </label>
    </div>
  );
}

export function TextPanel({ settings, update, dark, recent, remember, only }: { settings: Settings; update: Update; dark: boolean; recent: InkColor[]; remember: (c: InkColor) => void; only?: "colors" }) {
  const t = useMessages(inkText);
  const set = (patch: Partial<Settings["text"]>) => update((s) => ({ ...s, text: { ...s.text, ...patch } }));
  const colors = <Colors colors={PEN_COLORS} value={settings.text.color} onPick={(c) => set({ color: c })} dark={dark} recent={recent} remember={remember} />;
  if (only === "colors") return colors;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3 text-[12.5px] text-ink-3">
        <span className="w-16 shrink-0">{t.textSize}</span>
        <input type="range" min={12} max={80} step={1} value={settings.text.size} onChange={(e) => set({ size: Number(e.target.value) })} className="h-6 flex-1 cursor-pointer accent-[var(--blob)]" aria-label={t.textSize} />
        <span className="w-8 shrink-0 text-right tabular-nums text-ink-2">{settings.text.size}</span>
      </label>
      {colors}
    </div>
  );
}
