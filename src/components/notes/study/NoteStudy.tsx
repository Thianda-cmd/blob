"use client";

import { BookOpenCheck, Layers, ListChecks, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useLocale, useMessages } from "@/i18n/client";
import { studyText } from "@/i18n/messages/study";
import { makeCards } from "@/notes/study/cards";
import type { Pool } from "@/notes/study/quiz";
import type { Review } from "@/notes/study/srs";
import type { AccessRole } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { CardsMode } from "./CardsMode";
import { QuizMode } from "./QuizMode";
import { SummaryMode } from "./SummaryMode";
import { useCardEdits } from "./useCardEdits";

export type StudyMode = "cards" | "quiz" | "summary";

/** The note as the study screens need it. */
export type StudyPage = {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  content: unknown;
  subject_id: string | null;
  parent_id: string | null;
  tags: string[];
  topics: string[];
};

/** The study screen of a note: flashcards, quiz or summary, with a bar to switch and to go back. */
export function NoteStudy({
  page,
  userId,
  role,
  reviews,
  pool,
  initialMode,
  seed,
}: {
  page: StudyPage;
  userId: string;
  role: AccessRole;
  reviews: Review[];
  pool: Pool;
  initialMode: StudyMode;
  seed: number;
}) {
  const t = useMessages(studyText);
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<StudyMode>(initialMode);
  /** Progress shown in the bar while a round runs (0..1), or null. */
  const [progress, setProgress] = useState<number | null>(null);
  const title = pageTitle(page.title, "note", locale);
  const back = `/p/${page.id}`;

  const generated = useMemo(() => makeCards(page.content, title), [page.content, title]);
  const edits = useCardEdits(page.id);
  const cards = useMemo(() => edits.apply(generated), [edits, generated]);

  const choose = (next: StudyMode) => {
    setMode(next);
    setProgress(null);
    window.history.replaceState(window.history.state, "", `/study/note/${page.id}?mode=${next}`);
  };

  useEffect(() => {
    document.title = `${t.meta[mode](title)} · Blob`;
  }, [t, mode, title]);

  // Esc leaves (when no round is running: rounds handle their own Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || progress !== null || e.defaultPrevented) return;
      if ((document.activeElement as HTMLElement | null)?.closest("input, textarea, [role=dialog]")) return;
      router.push(back);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [progress, router, back]);

  const tabs: { mode: StudyMode; icon: ReactNode; label: string }[] = [
    { mode: "cards", icon: <Layers />, label: t.modes.cards },
    { mode: "quiz", icon: <ListChecks />, label: t.modes.quiz },
    { mode: "summary", icon: <BookOpenCheck />, label: t.modes.summary },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link href={back} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink" aria-label={t.back} title={t.backEsc}>
            <X className="size-5" />
          </Link>
          <span className="hidden min-w-0 max-w-[260px] items-center gap-1.5 truncate text-[13px] font-medium text-ink-2 md:flex" title={title}>
            {page.icon && <span className="text-[14px] leading-none">{page.icon}</span>}
            <span className="truncate">{title}</span>
          </span>
          <nav className="mx-auto flex rounded-xl border border-line bg-surface p-0.5" aria-label={t.modesLabel}>
            {tabs.map((tab) => (
              <button
                key={tab.mode}
                onClick={() => choose(tab.mode)}
                aria-current={mode === tab.mode ? "page" : undefined}
                className={cn(
                  "relative flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors [&_svg]:size-4 sm:px-3 [@media(hover:none)]:h-9",
                  mode === tab.mode ? "text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                {mode === tab.mode && (
                  <motion.span layoutId="study-mode" className="absolute inset-0 rounded-[10px] bg-raised shadow-card" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                )}
                <span className="relative">{tab.icon}</span>
                <span className="relative max-[420px]:sr-only">{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="hidden w-[min(220px,22vw)] shrink-0 md:block">
            {progress !== null && (
              <div className="relative h-2 overflow-hidden rounded-full bg-line">
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-blob" initial={false} animate={{ width: `${Math.max(3, progress * 100)}%` }} transition={{ type: "spring", stiffness: 140, damping: 24 }} />
              </div>
            )}
          </div>
        </div>
        {/* Phones: the progress runs along the bottom of the bar. */}
        {progress !== null && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line md:hidden">
            <motion.div className="h-full bg-blob" initial={false} animate={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </header>

      <main className="flex-1">
        {mode === "cards" ? (
          <CardsMode
            pageId={page.id}
            title={title}
            cards={cards}
            generated={generated}
            edits={edits}
            empty={!generated.length}
            reviews={reviews}
            userId={userId}
            onProgress={setProgress}
            onQuiz={() => choose("quiz")}
          />
        ) : mode === "quiz" ? (
          <QuizMode pageId={page.id} content={page.content} cards={cards} pool={pool} seed={seed} onProgress={setProgress} onCards={() => choose("cards")} />
        ) : (
          <SummaryMode page={page} title={title} cards={generated} userId={userId} role={role} onCards={() => choose("cards")} />
        )}
      </main>
    </div>
  );
}
