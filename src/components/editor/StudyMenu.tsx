"use client";

import { BookOpenCheck, ChevronDown, GraduationCap, Layers, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { cn } from "@/lib/utils";

type Mode = "cards" | "quiz" | "summary";

/**
 * "Lernen" in the note's top bar: turn the note into flashcards, a quiz or a summary. `due`: flashcards
 * of this note due for review today (shown as a badge).
 */
export function StudyMenu({ pageId, beforeOpen, due = 0 }: { pageId: string; beforeOpen: () => Promise<void>; due?: number }) {
  const t = useMessages(editorText).study;
  const router = useRouter();
  const items: { mode: Mode; icon: ReactNode; title: string; hint: string; badge?: number }[] = [
    { mode: "cards", icon: <Layers />, title: t.cards, hint: due > 0 ? t.due(due) : t.cardsHint, badge: due },
    { mode: "quiz", icon: <ListChecks />, title: t.quiz, hint: t.quizHint },
    { mode: "summary", icon: <BookOpenCheck />, title: t.summary, hint: t.summaryHint },
  ];

  return (
    <Popover
      align="end"
      className="w-[264px] p-1.5"
      label={t.label}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          title={t.title}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-9",
            "max-sm:w-9 max-sm:justify-center max-sm:px-0",
            props["aria-expanded"] && "bg-hover text-ink",
          )}
        >
          <span className="relative">
            <GraduationCap className="size-4" />
            {due > 0 && (
              // Phones: the count sits on the icon (the label is hidden there).
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-blob px-1 text-[10px] font-semibold tabular-nums leading-none text-white ring-2 ring-paper sm:hidden" aria-hidden>
                {due}
              </span>
            )}
          </span>
          <span className="max-sm:sr-only">{t.label}</span>
          {due > 0 && (
            <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blob px-1.5 text-[11px] font-semibold tabular-nums leading-none text-white max-sm:sr-only" title={t.due(due)}>
              <span aria-hidden>{due}</span>
              <span className="sr-only">{t.due(due)}</span>
            </span>
          )}
          <ChevronDown className="size-3 text-ink-3 max-sm:hidden" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2 pb-1.5 pt-1 text-[11.5px] leading-snug text-ink-3">{t.intro}</div>
          {items.map((item) => (
            <button
              key={item.mode}
              type="button"
              role="menuitem"
              onClick={async () => {
                close();
                await beforeOpen();
                router.push(`/study/note/${pageId}?mode=${item.mode}`);
              }}
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-2 transition-colors group-hover:border-line-2 group-hover:text-blob-ink [&_svg]:size-4">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium leading-tight text-ink">{item.title}</span>
                <span className={cn("mt-0.5 block truncate text-[12px] leading-tight", item.badge ? "text-blob-ink" : "text-ink-3")}>{item.hint}</span>
              </span>
              {!!item.badge && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blob px-1.5 text-[11px] font-semibold tabular-nums text-white">{item.badge}</span>
              )}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}
