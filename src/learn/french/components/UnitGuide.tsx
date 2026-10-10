"use client";

import { ArrowLeft, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Blob } from "@/components/blob/Blob";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { learnText } from "@/i18n/messages/learn";
import { resolveText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import type { Unit } from "../types";
import { Bold } from "./parts";

/** The unit's guidebook: Blob's tips, the key phrases and all its words. */
export function UnitGuide({ unit, startHref }: { unit: Unit; startHref: string | null }) {
  const t = useMessages(frenchText);
  const lt = useMessages(learnText);
  const locale = useLocale();
  const lang = locale;
  const phrases = unit.sentences.filter((s, i, all) => all.findIndex((x) => x.lesson === s.lesson) === i || i % 4 === 0).slice(0, 8);

  return (
    <>
      <TopBar
        crumbs={[
          { label: lt.learn, icon: <GraduationCap className="size-3.5" />, href: "/learn" },
          { label: t.title, href: "/learn/french" },
          { label: resolveText(unit.title, locale) },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-5 pb-20 pt-4 sm:px-8">
          <Link href="/learn/french" className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-ink-3 hover:bg-hover hover:text-ink">
            <ArrowLeft className="size-4" /> {t.guide.backToPath}
          </Link>
          <header className="flex flex-wrap items-center gap-5 rounded-3xl border border-line bg-raised p-5 shadow-card sm:p-6">
            <Blob size={104} mood="happy" accessory="beret" className="max-sm:size-[84px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <BookOpen className="size-3.5" /> {t.home.unit(unit.n)} · {t.guide.title}
              </div>
              <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">
                {unit.emoji} {resolveText(unit.title, locale)}
              </h1>
              <p className="mt-1 text-[14.5px] text-ink-2">{resolveText(unit.goal, locale)}</p>
            </div>
            {startHref && (
              <Link
                href={startHref}
                className="flex h-12 items-center rounded-2xl bg-blob px-6 text-[14.5px] font-bold uppercase tracking-wide text-white shadow-[0_4px_0_var(--blob-deep)] transition-transform active:translate-y-[2px] active:shadow-none max-sm:w-full max-sm:justify-center"
              >
                {t.guide.startUnit}
              </Link>
            )}
          </header>

          <h2 className="mb-3 mt-9 font-display text-[20px] font-semibold">{t.guide.tips}</h2>
          <div className="space-y-4">
            {unit.tips.map((tip, i) => (
              <article key={i} className="rounded-3xl border border-line bg-raised p-5 shadow-card">
                <h3 className="font-display text-[18px] font-semibold">{resolveText(tip.title, locale)}</h3>
                <div className="mt-2 space-y-2.5 text-[15px] leading-relaxed text-ink-2">
                  {resolveText(tip.body, locale)
                    .split("\n\n")
                    .map((p, j) => (
                      <p key={j}>
                        <Bold text={p} />
                      </p>
                    ))}
                </div>
                {tip.table && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[320px] border-separate border-spacing-0 overflow-hidden rounded-xl border border-line text-[14.5px]">
                      <thead>
                        <tr>
                          {tip.table.head.map((h, j) => (
                            <th key={j} className="border-b border-line bg-surface px-3 py-2 text-left font-semibold">
                              {resolveText(h, locale)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tip.table.rows.map((row, j) => (
                          <tr key={j} className="[&:last-child>td]:border-b-0">
                            {row.map((cell, k) => (
                              <td key={k} lang={k > 0 ? "fr" : undefined} className={cn("border-b border-line px-3 py-2", k > 0 && "font-medium text-ink")}>
                                {resolveText(cell, locale)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ul className="mt-4 space-y-2">
                  {tip.examples.map((ex, j) => (
                    <li key={j} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
                      <div className="min-w-0">
                        <div lang="fr" className="font-medium text-ink">
                          {ex.fr}
                        </div>
                        <div className="text-[13.5px] text-ink-3">{ex[lang]}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <h2 className="mb-3 mt-9 font-display text-[20px] font-semibold">{t.guide.keyPhrases}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {phrases.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-2.5">
                <div className="min-w-0">
                  <div lang="fr" className="font-medium text-ink">
                    {s.fr}
                  </div>
                  <div className="text-[13.5px] text-ink-3">{s[lang]}</div>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="mb-3 mt-9 font-display text-[20px] font-semibold">{t.guide.words}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-2">
            {unit.words.map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-3 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-[22px]">{w.emoji ?? "💬"}</span>
                <div className="min-w-0 flex-1">
                  <div lang="fr" className="truncate font-medium text-ink" title={w.fr}>
                    {w.fr}
                  </div>
                  <div className="truncate text-[13px] text-ink-3" title={w[lang]}>
                    {w[lang]}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
