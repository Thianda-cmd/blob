"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Check, FilePlus2, Layers, Lightbulb, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { useLocale, useMessages } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { studyText } from "@/i18n/messages/study";
import { MathView } from "@/learn/components/MathView";
import { summaryNote } from "@/notes/convert";
import { insertNote } from "@/notes/pages";
import type { Card } from "@/notes/study/cards";
import { summarize, type Point } from "@/notes/study/summary";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { StudyPage } from "./NoteStudy";
import { RichLine } from "./RichLine";

/** The note boiled down: its key points, terms, dates and formulas, printable and savable as a note. */
export function SummaryMode({ page, title, cards, userId, role, onCards }: { page: StudyPage; title: string; cards: Card[]; userId: string; role: AccessRole; onCards: () => void }) {
  const t = useMessages(studyText);
  const locale = useLocale();
  const summary = useMemo(() => summarize(page.content, title, cards), [page.content, title, cards]);
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");
  const [saved, setSaved] = useState<string | null>(null);
  const empty = !summary.sections.length && !summary.terms.length && !summary.formulas.length;
  const shorter = summary.stats.words ? Math.max(0, Math.round((1 - summary.stats.keptWords / summary.stats.words) * 100)) : 0;
  const formulaLabel = new Map(summary.formulas.map((f) => [f.src, f.label]));
  const words = t.summary.stats(formatNumber(summary.stats.keptWords, locale), formatNumber(summary.stats.words, locale));

  async function save() {
    setSaving("saving");
    const { content, plain_text } = summaryNote(summary, title, { gist: t.summary.gist, terms: t.summary.terms, dates: t.summary.dates, formulas: t.summary.formulas, source: t.summary.source }, page.id);
    // Next to the note when it's yours; in your own notes when it was shared with you.
    const own = page.user_id === userId;
    const created = await insertNote(createClient(), userId, {
      title: t.summary.noteTitle(title),
      content,
      plain_text,
      subject_id: own ? page.subject_id : null,
      parent_id: own || role === "editor" ? page.parent_id : null,
      tags: [...new Set([...page.tags, t.summary.tag])].slice(0, 20),
      topics: page.topics,
      links: [page.id],
    });
    if (!created) {
      setSaving("error");
      return;
    }
    setSaving("idle");
    setSaved(created.id);
  }

  if (empty) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col items-center px-5 py-20 text-center">
        <Blob size={120} mood="sleepy" track={false} />
        <p className="mt-3 text-[15px] text-ink-2">{t.summary.empty}</p>
        <Link href={`/p/${page.id}`} className="mt-5 inline-flex h-10 items-center rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink/88">
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10 print:max-w-none print:p-0">
      {/* Actions */}
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <div className="mr-auto text-[12.5px] text-ink-3">
          {words}
          {shorter > 0 && <span className="ml-1.5 rounded-full bg-ok/12 px-1.5 py-px font-semibold text-ok">{t.summary.shorter(shorter)}</span>}
        </div>
        <button onClick={() => window.print()} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Printer className="size-4" /> {t.summary.print}
        </button>
        <button onClick={onCards} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-raised px-3 text-[13px] font-medium text-ink shadow-card hover:border-line-2">
          <Layers className="size-4" /> {t.summary.studyCards}
        </button>
        {saved ? (
          <Link href={`/p/${saved}`} className="flex h-9 items-center gap-1.5 rounded-xl bg-ok px-3 text-[13px] font-semibold text-white shadow-card">
            <Check className="size-4" strokeWidth={2.6} /> {t.summary.saved} · {t.summary.open} <ArrowUpRight className="size-3.5" />
          </Link>
        ) : (
          <button
            onClick={save}
            disabled={saving === "saving"}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-blob px-3 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-blob-deep disabled:opacity-60"
          >
            <FilePlus2 className="size-4" /> {saving === "saving" ? t.summary.saving : t.summary.save}
          </button>
        )}
      </div>
      {saving === "error" && (
        <p className="-mt-3 mb-5 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger print:hidden" role="alert">
          {t.summary.failed}
        </p>
      )}

      <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-line bg-raised px-5 py-7 shadow-card sm:px-10 sm:py-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.summary.title}</div>
        <h1 className="mt-1 text-balance font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">
          {page.icon && <span className="mr-2">{page.icon}</span>}
          {title}
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-3 print:hidden">{t.summary.intro}</p>

        {summary.gist.length > 0 && (
          <section className="mt-6 rounded-2xl border border-blob/25 bg-blob-soft/40 px-4 py-4 sm:px-5 print:break-inside-avoid">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-blob-ink">
              <Lightbulb className="size-4" /> {t.summary.gist}
            </h2>
            <ol className="mt-2.5 space-y-2">
              {summary.gist.map((l, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blob text-[11px] font-bold text-white">{i + 1}</span>
                  <RichLine line={l} />
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mt-8 space-y-7">
          {summary.sections.map((s, i) => (
            <section key={i} className="print:break-inside-avoid-page">
              {s.heading && (
                <h2 className={cn("font-display font-semibold tracking-[-0.01em] text-ink", s.level <= 1 ? "text-[22px]" : s.level === 2 ? "text-[19px]" : "text-[16.5px]")}>
                  <RichLine line={s.heading} />
                </h2>
              )}
              <div className="mt-2.5 space-y-2">
                {s.points.map((p, j) => (
                  <PointView key={j} point={p} label={p.kind === "math" ? formulaLabel.get(p.src) : undefined} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {summary.terms.length > 0 && (
          <section className="mt-9 border-t border-line pt-6 print:break-inside-avoid">
            <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{t.summary.terms}</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {summary.terms.map((term, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 print:break-inside-avoid">
                  <dt className="text-[14px] font-semibold text-ink">
                    <RichLine line={term.term} />
                  </dt>
                  <dd className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">
                    <RichLine line={term.meaning} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {summary.dates.length > 0 && (
          <section className="mt-9 border-t border-line pt-6 print:break-inside-avoid">
            <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{t.summary.dates}</h2>
            <ol className="relative mt-3 space-y-3 border-l-2 border-line pl-5">
              {summary.dates.map((d, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-raised bg-blob" />
                  <div className="text-[13px] font-semibold tabular-nums text-blob-ink">
                    <RichLine line={d.date} />
                  </div>
                  <div className="text-[14.5px] text-ink">
                    <RichLine line={d.event} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {summary.formulas.length > 0 && (
          <section className="mt-9 border-t border-line pt-6 print:break-inside-avoid">
            <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{t.summary.formulas}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {summary.formulas.map((f, i) => (
                <div key={i} className="overflow-x-auto rounded-xl border border-line bg-surface px-4 py-3">
                  {f.label && <div className="mb-1.5 text-[12.5px] font-medium text-ink-3">{f.label}</div>}
                  <MathView src={f.src} size="sm" animate={false} />
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-9 border-t border-line pt-4 text-[12px] text-ink-3">
          {t.summary.source(title)} · {words}
        </p>
      </motion.article>
    </div>
  );
}

function PointView({ point, label }: { point: Point; label?: string }) {
  if (point.kind === "math") {
    return (
      <div className="overflow-x-auto rounded-xl bg-surface px-4 py-3">
        {label && <div className="mb-1 text-[12px] font-medium text-ink-3">{label}</div>}
        <MathView src={point.src} size="sm" animate={false} />
      </div>
    );
  }
  if (point.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[13.5px]">
          <tbody>
            {point.rows.map((row, i) => (
              <tr key={i} className={cn(i > 0 && "border-t border-line", point.header && i === 0 && "bg-surface font-semibold")}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top text-ink-2 first:font-medium first:text-ink">
                    <RichLine line={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (point.kind === "rule") {
    return (
      <div className="rounded-xl border-l-[3px] border-blob bg-blob-soft/40 px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        <RichLine line={point.line} />
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 text-[15px] leading-relaxed text-ink" style={{ paddingLeft: point.depth * 18 }}>
      <span className={cn("mt-[0.62em] size-1.5 shrink-0 rounded-full", point.kind === "item" ? "bg-ink-3" : "bg-blob")} aria-hidden />
      <span className="min-w-0">
        <RichLine line={point.line} />
      </span>
    </div>
  );
}

