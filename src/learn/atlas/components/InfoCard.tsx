"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Lightbulb, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import type { Text } from "@/i18n/text";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

export type InfoContent = {
  /** Changes animate in when the key changes. */
  key: string;
  eyebrow?: string;
  title: Text;
  aka?: Text;
  tag?: Text;
  /** Small chips under the title (a time, a person). */
  chips?: { icon?: ReactNode; label: Text }[];
  leadLabel?: string;
  lead?: Text;
  facts?: Text[];
  tip?: Text;
};

/**
 * What you learn about the picked structure, step or milestone: its name, what it does, the
 * facts for the exam and a tip. Arrows walk through all of them in order.
 */
export function InfoCard({
  content,
  onPrev,
  onNext,
  onClose,
  className,
  footer,
}: {
  content: InfoContent;
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  className?: string;
  footer?: ReactNode;
}) {
  const t = useMessages(atlasText);
  return (
    <section className={cn("relative overflow-hidden rounded-2xl border border-line bg-raised shadow-card", className)} aria-live="polite">
      <div className="flex items-center gap-1 border-b border-line/70 px-4 py-2">
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold uppercase tracking-[0.09em] text-blob-ink">{content.eyebrow}</span>
        {onPrev && (
          <button type="button" onClick={onPrev} className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-hover hover:text-ink" aria-label={t.back} title={t.back}>
            <ChevronLeft className="size-4" />
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-hover hover:text-ink" aria-label={t.next} title={t.next}>
            <ChevronRight className="size-4" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink" aria-label={t.close} title={t.clear}>
            <X className="size-4" />
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={content.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5"
        >
          <Body content={content} />
          {footer}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Body({ content }: { content: InfoContent }) {
  const t = useMessages(atlasText);
  return (
    <>
      <h2 className="hyphens-auto font-display text-[23px] font-bold leading-tight tracking-[-0.015em] break-words">
        <Inline text={content.title} />
      </h2>
      {content.aka && (
        <p className="mt-0.5 text-[13.5px] leading-snug text-ink-3">
          <Inline text={content.aka} />
        </p>
      )}
      {(content.tag || content.chips?.length) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {content.tag && (
            <span className="rounded-full bg-blob-soft px-2.5 py-1 text-[11.5px] font-semibold text-blob-ink">
              <Inline text={content.tag} />
            </span>
          )}
          {content.chips?.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-hover px-2.5 py-1 text-[11.5px] font-medium text-ink-2">
              {c.icon}
              <Inline text={c.label} />
            </span>
          ))}
        </div>
      )}
      {content.lead && (
        <div className="mt-4">
          {content.leadLabel && <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{content.leadLabel}</div>}
          <p className="mt-1 text-[15px] font-medium leading-relaxed text-ink">
            <Inline text={content.lead} />
          </p>
        </div>
      )}
      {!!content.facts?.length && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.facts}</div>
          <ul className="mt-1.5 space-y-1.5">
            {content.facts.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-blob/70" aria-hidden />
                <span className="min-w-0">
                  <Inline text={f} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {content.tip && (
        <div className="mt-4 flex gap-2.5 rounded-xl bg-blob-soft/70 px-3.5 py-3 text-[13.5px] leading-relaxed text-ink">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-blob-ink" />
          <p className="min-w-0">
            <span className="font-semibold text-blob-ink">{t.tip}: </span>
            <Inline text={content.tip} />
          </p>
        </div>
      )}
    </>
  );
}
