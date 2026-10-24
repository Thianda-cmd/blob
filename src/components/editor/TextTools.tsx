"use client";

import type { Editor } from "@tiptap/core";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Ban, Check, Minus, Plus, RotateCcw, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useMessages } from "@/i18n/client";
import { noteToolsText } from "@/i18n/messages/noteTools";
import { cn } from "@/lib/utils";
import { HIGHLIGHTS, MAX_SIZE, MIN_SIZE, TEXT_COLORS, TEXT_SIZES, clampSize, colorVar, stepSize, type HighlightColor, type TextAlign, type TextColor } from "./formatting";

/** A px size with − and + and a field to type any size (the selection's text, a list, the note's text). */
export function SizeStepper({ value, onChange, label, typing = true }: { value: number; onChange: (px: number) => void; label: string; typing?: boolean }) {
  const t = useMessages(noteToolsText).size;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseFloat(draft.replace(",", "."));
    setDraft(null);
    if (Number.isFinite(n)) onChange(clampSize(n));
  };
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(stepSize(value, -1))} disabled={value <= MIN_SIZE} className="blob-tool-btn" aria-label={t.smaller} title={t.smaller}>
        <Minus />
      </button>
      <label className="flex h-7 min-w-0 items-center rounded-lg border border-line bg-surface pl-2 pr-1.5 text-[12.5px] focus-within:border-blob [@media(hover:none)]:h-8">
        {!typing ? (
          // Above a phone's keyboard a field would take the focus from the note (and the bar with it).
          <span className="w-[2.6em] text-right font-medium tabular-nums text-ink">{value}</span>
        ) : (
        <input
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(stepSize(value, e.key === "ArrowUp" ? 1 : -1));
            } else if (e.key === "Escape") setDraft(null);
          }}
          inputMode="numeric"
          aria-label={t.custom}
          title={t.custom}
          className="w-[2.6em] min-w-0 bg-transparent text-right font-medium tabular-nums text-ink outline-none"
        />
        )}
        <span className="ml-0.5 text-ink-3">px</span>
      </label>
      <button type="button" onClick={() => onChange(stepSize(value, 1))} disabled={value >= MAX_SIZE} className="blob-tool-btn" aria-label={t.larger} title={t.larger}>
        <Plus />
      </button>
    </div>
  );
}

/** Sizes to pick from at a glance. */
export function SizeGrid({ value, onPick }: { value: number | null; onPick: (px: number) => void }) {
  const t = useMessages(noteToolsText).size;
  return (
    <div className="grid grid-cols-6 gap-1">
      {TEXT_SIZES.map((px) => (
        <button
          key={px}
          type="button"
          onClick={() => onPick(px)}
          aria-label={t.px(px)}
          aria-pressed={value === px}
          className={cn(
            "h-7 rounded-lg text-[12px] font-medium tabular-nums transition-colors [@media(hover:none)]:h-8",
            value === px ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
          )}
        >
          {px}
        </button>
      ))}
    </div>
  );
}

/** Size of the selected text: steps, a typed size, the usual sizes, and back to normal. */
export function TextSizePanel({ editor, size, own, typing }: { editor: Editor; size: number; own: number | null; typing?: boolean }) {
  const t = useMessages(noteToolsText).size;
  const set = (px: number | null) => editor.chain().focus().setTextSize(px).run();
  return (
    <div className="w-[236px] space-y-2 p-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-3">{t.label}</span>
        <SizeStepper value={size} onChange={set} label={t.label} typing={typing} />
      </div>
      <SizeGrid value={own} onPick={set} />
      {own !== null && (
        <button type="button" onClick={() => set(null)} className="flex h-7 w-full items-center gap-2 rounded-lg px-2 text-[12.5px] text-ink-2 hover:bg-hover hover:text-ink">
          <RotateCcw className="size-3.5 text-ink-3" /> {t.reset}
        </button>
      )}
    </div>
  );
}

/** Colour of the selected text, from the theme's own colours, and the highlighter's colour. */
export function TextColorPanel({ editor, color, highlight }: { editor: Editor; color: TextColor | null; highlight?: HighlightColor | "blob" | null }) {
  const t = useMessages(noteToolsText).color;
  const set = (c: TextColor | null) => editor.chain().focus().setTextColor(c).run();
  const mark = (c: HighlightColor | "blob" | null) =>
    c === null ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().setHighlight({ color: (c === "blob" ? null : c) as string }).run();
  return (
    <div className="w-[208px] p-1.5">
      <div className="px-0.5 pb-1.5 text-[11px] font-medium text-ink-3">{t.label}</div>
      <div className="grid grid-cols-5 gap-1">
        <button
          type="button"
          onClick={() => set(null)}
          title={t.reset}
          aria-label={t.reset}
          aria-pressed={color === null}
          className={cn("grid size-8 place-items-center rounded-lg font-semibold text-ink transition-colors hover:bg-hover", color === null && "bg-hover")}
        >
          A
        </button>
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => set(c)}
            title={t.names[c]}
            aria-label={t.names[c]}
            aria-pressed={color === c}
            className={cn("relative grid size-8 place-items-center rounded-lg font-semibold transition-colors hover:bg-hover", color === c && "bg-hover")}
            style={{ color: colorVar(c) }}
          >
            A
            {color === c && <Check className="absolute bottom-0.5 right-0.5 size-2.5" strokeWidth={3} />}
          </button>
        ))}
      </div>
      {highlight !== undefined && (
        <>
          <div className="px-0.5 pb-1.5 pt-2.5 text-[11px] font-medium text-ink-3">{t.highlight}</div>
          <div className="grid grid-cols-5 gap-1">
            <button type="button" onClick={() => mark(null)} title={t.noHighlight} aria-label={t.noHighlight} aria-pressed={highlight === null} className={cn("grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover", highlight === null && "bg-hover")}>
              <Ban className="size-3.5" />
            </button>
            {(["blob", ...HIGHLIGHTS] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => mark(c)}
                title={t.names[c === "blob" ? "blob" : c]}
                aria-label={`${t.highlight}: ${t.names[c === "blob" ? "blob" : c]}`}
                aria-pressed={highlight === c}
                className={cn("grid size-8 place-items-center rounded-lg transition-colors hover:bg-hover", highlight === c && "bg-hover")}
              >
                <span className="relative grid h-4.5 w-6 place-items-center rounded-[4px] text-[11px] font-semibold text-ink" style={{ background: `color-mix(in oklab, var(${c === "blob" ? "--blob" : `--subject-${c}`}) ${c === "blob" ? 26 : 32}%, transparent)` }}>
                  ab
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const ALIGN_ICONS: { align: TextAlign | null; key: "left" | TextAlign; icon: LucideIcon }[] = [
  { align: null, key: "left", icon: AlignLeft },
  { align: "center", key: "center", icon: AlignCenter },
  { align: "right", key: "right", icon: AlignRight },
  { align: "justify", key: "justify", icon: AlignJustify },
];
/** The icon of an alignment. */
export function AlignGlyph({ align }: { align: TextAlign | null }) {
  const Icon = ALIGN_ICONS.find((x) => x.align === align)?.icon ?? AlignLeft;
  return <Icon />;
}

/** Left, centre, right or justified, for the paragraphs and headings in the selection. */
export function AlignRow({ editor, align }: { editor: Editor; align: TextAlign | null }) {
  const t = useMessages(noteToolsText).align;
  return (
    <div className="flex items-center gap-0.5 p-1" role="group" aria-label={t.label}>
      {ALIGN_ICONS.map(({ align: a, key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => editor.chain().focus().setTextAlign(a).run()}
          aria-label={t[key]}
          aria-pressed={align === a}
          title={t[key]}
          className={cn("blob-tool-btn", align === a && "bg-blob-soft! text-blob-ink!")}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
