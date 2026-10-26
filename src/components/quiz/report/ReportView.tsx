"use client";

import { motion } from "motion/react";
import { ArrowLeft, BadgeQuestionMark, Check, Download, Medal, Minus, Trophy, X } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { quizText } from "@/i18n/messages/quiz";
import { cn } from "@/lib/utils";
import { isRight } from "@/quiz/score";
import type { Report } from "@/quiz/server";
import { MiniBlob } from "../MiniBlob";
import { TYPE_ICONS } from "../editor/QuizEditor";

/** A finished (or running) game: the ranking, a grid of who got what right, and how each question went. */
export function ReportView({ report }: { report: Report }) {
  const t = useMessages(quizText);
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "long", timeStyle: "short" });
  const qs = report.questions;
  const graded = qs.filter((q) => q.question.type !== "poll" && q.answered > 0);
  const share = (q: (typeof qs)[number]) => (q.answered ? q.correct / q.answered : 0);
  const hardest = graded.length ? [...graded].sort((a, b) => share(a) - share(b))[0] : null;
  const easiest = graded.length > 1 ? [...graded].sort((a, b) => share(b) - share(a))[0] : null;

  const csv = () => {
    const head = ["#", t.report.name, t.report.score, t.report.correct, ...qs.map((q) => `Q${q.index + 1}`)];
    const rows = report.players.map((p) => [p.rank, p.nickname, p.score, p.correct, ...p.answers.map((a) => (a ? a.points : ""))]);
    const text = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(report.title || "quiz").replace(/[^\p{L}\p{N}]+/gu, "-")}-${report.createdAt.slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: t.nav, href: "/quiz", icon: <BadgeQuestionMark className="size-3.5 text-ink-3" /> },
          ...(report.quizId ? [{ label: report.title || t.untitled, href: `/quiz/${report.quizId}` }] : []),
          { label: t.report.title },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-3 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              {report.quizId && (
                <Link href={`/quiz/${report.quizId}`} className="mb-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-3 hover:text-ink">
                  <ArrowLeft className="size-3.5" /> {t.report.back}
                </Link>
              )}
              <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">{report.title || t.untitled}</h1>
              <p className="mt-1 text-[13.5px] text-ink-3">
                {t.report.played(fmt.format(new Date(report.createdAt)))} · {t.players(report.players.length)} · {t.questions(qs.length)}
              </p>
            </div>
            {report.players.length > 0 && (
              <button type="button" onClick={csv} className="flex h-9 items-center gap-2 rounded-xl border border-line bg-raised px-3 text-[13px] font-medium text-ink shadow-card hover:bg-hover/60">
                <Download className="size-4" /> {t.report.download}
              </button>
            )}
          </header>

          {report.players.length === 0 ? (
            <p className="mt-10 text-center text-ink-3">{t.report.none}</p>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {report.players.slice(0, 3).map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className={cn("flex items-center gap-3 rounded-3xl border px-4 py-3", i === 0 ? "border-transparent bg-blob text-white" : "border-line bg-raised")}>
                    <MiniBlob look={p.look} size={54} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold opacity-80">
                        {i === 0 ? <Trophy className="size-3.5" /> : <Medal className="size-3.5" />} {t.host.places[i]}
                      </p>
                      <p className="truncate text-[16px] font-bold">{p.nickname}</p>
                      <p className="text-[13px] tabular-nums opacity-80">{p.score.toLocaleString(intlLocale(locale))}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {(hardest || easiest) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {hardest && <Highlight label={t.report.hardest} text={hardest.question.text} pct={Math.round(share(hardest) * 100)} tone="hard" t={t} />}
                  {easiest && easiest !== hardest && <Highlight label={t.report.easiest} text={easiest.question.text} pct={Math.round(share(easiest) * 100)} tone="easy" t={t} />}
                </div>
              )}

              <section className="mt-8">
                <h2 className="mb-3 font-display text-[19px] font-semibold">{t.report.players}</h2>
                <div className="overflow-x-auto rounded-2xl border border-line bg-raised">
                  <table className="w-full min-w-[520px] text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                        <th className="px-3 py-2">{t.report.rank}</th>
                        <th className="px-3 py-2">{t.report.name}</th>
                        <th className="px-3 py-2 text-right">{t.report.score}</th>
                        <th className="px-3 py-2 text-right">{t.report.correct}</th>
                        {qs.map((q) => (
                          <th key={q.index} className="px-1.5 py-2 text-center">
                            {q.index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.players.map((p) => (
                        <tr key={p.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 font-semibold tabular-nums text-ink-2">{p.rank}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2 font-medium text-ink">
                              <MiniBlob look={p.look} size={24} bounce={false} />
                              {p.nickname}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{p.score.toLocaleString(intlLocale(locale))}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink-2">
                            {p.correct}/{graded.length || qs.length}
                          </td>
                          {p.answers.map((a, i) => (
                            <td key={i} className="px-1.5 py-2 text-center">
                              <Cell a={a} poll={qs[i]?.question.type === "poll"} title={a ? `${a.points}` : t.report.unanswered} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-8">
                <h2 className="mb-3 font-display text-[19px] font-semibold">{t.report.questions}</h2>
                <ol className="flex flex-col gap-2">
                  {qs.map((q) => {
                    const Icon = TYPE_ICONS[q.question.type];
                    const pct = Math.round(share(q) * 100);
                    return (
                      <li key={q.index} className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blob-soft text-[13px] font-bold text-blob-ink">{q.index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-ink">{q.question.text}</p>
                          <p className="flex items-center gap-2 text-[12px] text-ink-3">
                            <Icon className="size-3.5" /> {t.types[q.question.type]}
                            {q.averageMs !== null && <span>{t.report.averageTime((q.averageMs / 1000).toFixed(1))}</span>}
                          </p>
                        </div>
                        {q.question.type !== "poll" && (
                          <div className="flex w-[140px] shrink-0 flex-col items-end gap-1">
                            <span className="text-[12.5px] font-semibold tabular-nums text-ink-2">{t.report.accuracy(pct)}</span>
                            <span className="h-2 w-full overflow-hidden rounded-full bg-line">
                              <span className={cn("block h-full rounded-full", pct >= 70 ? "bg-ok" : pct >= 40 ? "bg-[#d99000]" : "bg-danger")} style={{ width: `${pct}%` }} />
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Cell({ a, poll, title }: { a: { fraction: number | null; points: number } | null; poll: boolean; title: string }) {
  if (!a) return <Minus className="mx-auto size-3.5 text-ink-3" aria-label={title} />;
  if (poll) return <Check className="mx-auto size-3.5 text-ink-3" aria-label={title} />;
  if (isRight(a.fraction)) return <span title={title} className="mx-auto grid size-5 place-items-center rounded-full bg-ok text-white"><Check className="size-3" strokeWidth={3.4} /></span>;
  if (a.fraction && a.fraction > 0) return <span title={title} className="mx-auto grid size-5 place-items-center rounded-full bg-[#d99000] text-[10px] font-bold text-white">½</span>;
  return <span title={title} className="mx-auto grid size-5 place-items-center rounded-full bg-danger text-white"><X className="size-3" strokeWidth={3.4} /></span>;
}

function Highlight({ label, text, pct, tone, t }: { label: string; text: string; pct: number; tone: "hard" | "easy"; t: (typeof quizText)["en"] }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", tone === "hard" ? "border-danger/25 bg-danger/5" : "border-ok/25 bg-ok/5")}>
      <p className={cn("text-[11.5px] font-semibold uppercase tracking-wide", tone === "hard" ? "text-danger" : "text-ok")}>{label}</p>
      <p className="mt-0.5 line-clamp-2 text-[14px] font-medium text-ink">{text}</p>
      <p className="mt-1 text-[12.5px] text-ink-3">{t.report.accuracy(pct)}</p>
    </div>
  );
}
