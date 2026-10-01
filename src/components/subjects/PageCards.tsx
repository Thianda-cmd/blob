"use client";

import { formatDistanceStrict } from "date-fns";
import { CornerDownRight, FilePlus2, Presentation } from "lucide-react";
import Link from "next/link";
import { FONTS, miniBackdrop, presetSpec, specPalette } from "@/components/deck/deck";
import { deckFontVars } from "@/components/deck/fonts";
import { PageIcon } from "@/components/shell/Sidebar";
import type { DeckThemeSpec, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

export type PagePreview = {
  /** First bit of the note's text. */
  snippet: string;
  /** Title of the first slide (presentations). */
  slideTitle: string | null;
  /** The deck's theme (a preset's spec or its custom theme), resolved on the server. */
  theme: DeckThemeSpec | null;
};

function edited(updatedAt: string, now: number | null) {
  if (!now) return " ";
  const d = new Date(updatedAt);
  if (now - d.getTime() < 60_000) return "Edited just now";
  return `Edited ${formatDistanceStrict(d, now, { addSuffix: true })}`;
}

const cardBase =
  "group relative flex flex-col rounded-xl border border-line bg-raised shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_1px_1px_rgb(28_27_24/0.04),0_8px_20px_-8px_rgb(28_27_24/0.18)] active:translate-y-0";

export function NoteCard({ page, preview, parent, now }: { page: PageMeta; preview?: PagePreview; parent?: PageMeta; now: number | null }) {
  const snippet = preview?.snippet?.trim();
  return (
    <Link href={`/p/${page.id}`} className={cn(cardBase, "h-[150px] p-3.5")}>
      <div className="flex min-w-0 items-center gap-2">
        <PageIcon page={page} />
        <span className="truncate text-[14px] font-medium text-ink">{pageTitle(page.title, page.kind)}</span>
      </div>
      <p className={cn("mt-2 line-clamp-3 text-[12.5px] leading-[1.55]", snippet ? "text-ink-3" : "italic text-ink-3/70")}>
        {snippet || "Empty note. Click to start writing."}
      </p>
      <div className="mt-auto flex min-w-0 items-center gap-2 pt-2 text-[11.5px] text-ink-3">
        {parent && (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <CornerDownRight className="size-3 shrink-0" />
            <span className="truncate">{pageTitle(parent.title, parent.kind)}</span>
          </span>
        )}
        <span className="ml-auto shrink-0">{edited(page.updated_at, now)}</span>
      </div>
    </Link>
  );
}

/** A tiny 16:9 rendering of the first slide, in the deck's theme. */
export function SlideThumb({ title, theme, className }: { title: string; theme: DeckThemeSpec | null; className?: string }) {
  const spec = theme ?? presetSpec("paper");
  const p = specPalette(spec);
  const h = FONTS[p.heading];
  return (
    <div
      className={cn("relative aspect-video overflow-hidden rounded-lg ring-1 ring-inset ring-black/[0.06]", deckFontVars, className)}
      style={{ backgroundColor: p.bg, ...miniBackdrop(spec), color: p.fg }}
    >
      <div className="absolute inset-0 flex flex-col justify-center px-[9%]">
        <span className="h-[3px] w-5 rounded-full" style={{ background: p.accent }} />
        <span
          className="mt-2 line-clamp-2 text-[16px] leading-[1.15]"
          style={{ fontFamily: h.family, fontWeight: h.weights[2], letterSpacing: `${-0.02 * h.track}em`, color: p.title }}
        >
          {title}
        </span>
        <span className="mt-2 h-[5px] w-[46%] rounded-full bg-current opacity-15" />
      </div>
      <span className="absolute bottom-[7%] right-[6%] text-[8px] font-medium tabular-nums opacity-40">1</span>
    </div>
  );
}

export function DeckCard({ page, preview, now }: { page: PageMeta; preview?: PagePreview; now: number | null }) {
  const name = pageTitle(page.title, page.kind);
  return (
    <Link href={`/p/${page.id}`} className={cn(cardBase, "p-2")}>
      <SlideThumb title={preview?.slideTitle?.trim() || name} theme={preview?.theme ?? null} className="transition-transform duration-300 group-hover:scale-[1.012]" />
      <div className="flex min-w-0 items-center gap-2 px-1.5 pb-1 pt-2.5">
        <PageIcon page={page} className="size-3.5" />
        <span className="truncate text-[13.5px] font-medium text-ink">{name}</span>
      </div>
      <div className="px-1.5 pb-0.5 text-[11.5px] text-ink-3">{edited(page.updated_at, now)}</div>
    </Link>
  );
}

export function NewCard({ kind, onClick, busy }: { kind: "note" | "deck"; onClick: () => void; busy?: boolean }) {
  const Icon = kind === "deck" ? Presentation : FilePlus2;
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-2 text-[12.5px] text-ink-3 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink disabled:opacity-60",
        kind === "deck" ? "min-h-[150px]" : "h-[150px]",
      )}
    >
      <Icon className="size-4" />
      {kind === "deck" ? "New presentation" : "New note"}
    </button>
  );
}
