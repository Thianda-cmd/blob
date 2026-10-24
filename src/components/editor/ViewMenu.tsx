"use client";

import { ALargeSmall } from "lucide-react";
import { Popover } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { useMessages } from "@/i18n/client";
import { noteToolsText } from "@/i18n/messages/noteTools";
import { cn } from "@/lib/utils";
import { SizeStepper } from "./TextTools";
import { DEFAULT_VIEW, useViewPrefs, viewPrefs, type CaretMode, type NoteWidth } from "./viewPrefs";

/** "Aa" in the note's top bar: how notes look on this device. */
export function ViewMenu() {
  const t = useMessages(noteToolsText).view;
  const prefs = useViewPrefs();
  const changed = JSON.stringify(prefs) !== JSON.stringify(DEFAULT_VIEW);
  const touch = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;

  return (
    <Popover
      align="end"
      role="dialog"
      label={t.label}
      className="w-[280px] p-3"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          title={t.label}
          aria-label={t.label}
          className={cn(
            "grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9",
            props["aria-expanded"] && "bg-hover text-ink",
          )}
        >
          <ALargeSmall className="size-4" />
        </button>
      )}
    >
      <div className="space-y-3.5">
        <p className="text-[12px] leading-snug text-ink-3">{t.intro}</p>
        <Row label={t.textSize}>
          <SizeStepper value={prefs.textSize} onChange={(px) => viewPrefs.set({ textSize: Math.min(28, Math.max(12, px)) })} label={t.textSize} />
        </Row>
        <Row label={t.width}>
          <Segmented<NoteWidth>
            size="sm"
            label={t.width}
            value={prefs.width}
            onChange={(width) => viewPrefs.set({ width })}
            options={(["normal", "wide", "full"] as const).map((w) => ({ value: w, label: t.widths[w] }))}
          />
        </Row>
        {!touch && (
          <div>
            <Row label={t.caret}>
              <Segmented<CaretMode>
                size="sm"
                label={t.caret}
                value={prefs.caret}
                onChange={(caret) => viewPrefs.set({ caret })}
                options={(["auto", "bold", "system"] as const).map((c) => ({ value: c, label: t.carets[c] }))}
              />
            </Row>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{t.caretHint}</p>
          </div>
        )}
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={prefs.focus}
            onChange={(e) => viewPrefs.set({ focus: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-[var(--blob)]"
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">{t.focus}</span>
            <span className="block text-[11.5px] leading-snug text-ink-3">{t.focusHint}</span>
          </span>
        </label>
        {changed && (
          <button type="button" onClick={() => viewPrefs.set(DEFAULT_VIEW)} className="text-[12px] font-medium text-blob-ink hover:underline">
            {t.reset}
          </button>
        )}
      </div>
    </Popover>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
    </div>
  );
}
