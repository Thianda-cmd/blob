"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useMessages } from "@/i18n/client";
import { studyText } from "@/i18n/messages/study";
import { StudyButton } from "@/learn/components/StudyChrome";
import { Tutor } from "@/learn/components/Tutor";

/** A note Blob can't make cards (or a quiz) from yet, with what helps. */
export function EmptyNote({ pageId, title, text }: { pageId: string; title?: string; text?: string }) {
  const t = useMessages(studyText).empty;
  return (
    <div className="mx-auto grid w-full max-w-[860px] items-center gap-8 px-5 py-10 md:min-h-[calc(100dvh-3.5rem-1px)] md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="mx-auto">
        <Tutor say={null} mood="thinking" accessory="glasses" size={150} />
      </div>
      <div>
        <h1 className="text-balance font-display text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[30px]">{title ?? t.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text ?? t.text}</p>
        <ul className="mt-4 space-y-2">
          {t.tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[14px] text-ink shadow-card">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blob-soft text-blob-ink">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {tip}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <StudyButton href={`/p/${pageId}`} variant="ink">
            <ArrowLeft className="size-4" /> {t.toNote}
          </StudyButton>
        </div>
      </div>
    </div>
  );
}
