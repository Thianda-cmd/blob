"use client";

import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Layers, RotateCcw, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { BlobHandle, BlobMood } from "@/components/blob/Blob";
import { useMessages } from "@/i18n/client";
import { studyText } from "@/i18n/messages/study";
import { Confetti } from "@/learn/components/Confetti";
import { Ring } from "@/learn/components/Ring";
import { CountUp, StudyButton } from "@/learn/components/StudyChrome";
import { Tutor } from "@/learn/components/Tutor";
import { docText, plain, type Line } from "@/notes/doc";
import type { Card } from "@/notes/study/cards";
import { makeQuiz, type Pool, type Question } from "@/notes/study/quiz";
import { detectLang, sameAnswer } from "@/notes/text";
import { cn } from "@/lib/utils";
import { EmptyNote } from "./EmptyNote";
import { RichLine, RichLines } from "./RichLine";

type Given = { correct: boolean; close?: boolean; answer: string };

const pick = <T,>(list: T[], n: number) => list[n % list.length];

export function QuizMode({
  pageId,
  content,
  cards,
  pool,
  seed: firstSeed,
  onProgress,
  onCards,
}: {
  pageId: string;
  content: unknown;
  cards: Card[];
  pool: Pool;
  seed: number;
  onProgress: (p: number | null) => void;
  onCards: () => void;
}) {
  const t = useMessages(studyText);
  const [seed, setSeed] = useState(firstSeed);
  const lang = useMemo(() => detectLang(docText(content)), [content]);
  const questions = useMemo(() => makeQuiz(cards.filter((c) => c.front.length && c.back.length), pool, { seed, lang }), [cards, pool, seed, lang]);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<(Given | null)[]>([]);
  const [finished, setFinished] = useState(false);
  const [say, setSay] = useState<string | null>(null);
  const [mood, setMood] = useState<BlobMood>("happy");
  const blobRef = useRef<BlobHandle>(null);

  const q = questions[index];
  const current = given[index] ?? null;

  useEffect(() => {
    onProgress(finished || !questions.length ? null : index / questions.length);
  }, [index, finished, questions.length, onProgress]);
  useEffect(() => () => onProgress(null), [onProgress]);

  function answerWith(g: Given) {
    if (current) return;
    setGiven((list) => {
      const next = [...list];
      next[index] = g;
      return next;
    });
    if (g.correct) {
      setMood("excited");
      blobRef.current?.celebrate();
      setSay(g.close ? t.quiz.close : pick(t.quiz.right, index));
    } else {
      setMood("worried");
      blobRef.current?.shake();
      setSay(t.quiz.wrong);
    }
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      const right = given.filter((g) => g?.correct).length;
      setSay(right === questions.length ? t.quiz.blobPerfect : null);
      return;
    }
    setIndex((i) => i + 1);
    setSay(null);
    setMood("happy");
  }

  function restart() {
    setSeed((s) => (s * 48271 + 11) % 2147483647);
    setIndex(0);
    setGiven([]);
    setFinished(false);
    setSay(null);
    setMood("happy");
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (finished || !q) return;
    const typing = (document.activeElement as HTMLElement | null)?.closest("input, textarea");
    if (current && e.key === "Enter") {
      e.preventDefault();
      next();
      return;
    }
    if (current || typing) return;
    if (q.kind === "choice") {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) answerWith({ correct: n - 1 === q.correct, answer: plain(q.options[n - 1]) });
    } else if (q.kind === "truefalse") {
      if (e.key === "1" || e.key === "ArrowLeft") answerWith({ correct: q.truth, answer: t.quiz.true });
      if (e.key === "2" || e.key === "ArrowRight") answerWith({ correct: !q.truth, answer: t.quiz.false });
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (questions.length < 3) return <EmptyNote pageId={pageId} title={t.quiz.tooFew} text={t.quiz.tooFewText} />;

  if (finished) {
    const right = given.filter((g) => g?.correct).length;
    const pct = Math.round((right / questions.length) * 100);
    const verdict = pct >= 90 ? t.quiz.verdict.great : pct >= 70 ? t.quiz.verdict.good : pct >= 50 ? t.quiz.verdict.ok : t.quiz.verdict.low;
    const wrong = questions.map((qq, i) => ({ q: qq, g: given[i] })).filter((x) => !x.g?.correct);
    return (
      <div className="mx-auto w-full max-w-[900px] px-5 pb-20 pt-8 sm:pt-12">
        <div className="grid items-center gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative mx-auto grid place-items-center overflow-x-clip">
            {pct >= 70 && <Confetti seed={9} spread={220} />}
            <Tutor say={say ?? verdict} mood={pct >= 70 ? "excited" : "happy"} accessory="cap" size={150} side="left" blobRef={blobRef} />
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.quiz.title}</div>
            <h1 className="mt-1 font-display text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{verdict}</h1>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-card">
              <Ring value={pct / 100} from={0} size={76} stroke={8} delay={0.2}>
                <span className="text-[17px] font-bold tabular-nums">
                  <CountUp value={pct} from={0} delay={0.25} />%
                </span>
              </Ring>
              <div>
                <div className="font-display text-[22px] font-semibold text-ink">{t.quiz.score(right, questions.length)}</div>
                <div className="text-[13px] text-ink-3">
                  {t.quiz.correctStat} {right} · {t.quiz.wrongStat} {questions.length - right}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <StudyButton onClick={restart} variant="blob">
                <RotateCcw className="size-4" /> {t.quiz.newQuiz}
              </StudyButton>
              <StudyButton onClick={onCards} variant="ink">
                <Layers className="size-4" /> {t.quiz.studyCards}
              </StudyButton>
              <StudyButton href={`/p/${pageId}`} variant="ghost">
                <ArrowLeft className="size-4" /> {t.quiz.backToNote}
              </StudyButton>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-3 font-display text-[19px] font-semibold tracking-[-0.01em]">{wrong.length ? t.quiz.review : t.quiz.allRight}</h2>
          <ul className="space-y-2">
            {wrong.map(({ q: wq, g }) => (
              <li key={wq.id} className="rounded-2xl border border-line bg-raised p-4 shadow-card">
                <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{wq.card.context}</div>
                <div className="mt-1 text-[14.5px] font-medium text-ink">
                  {wq.column && <span className="mr-1.5 text-[12.5px] font-semibold text-blob-ink">{t.quiz.ask.column(wq.column)}</span>}
                  <RichLines lines={wq.prompt} />
                </div>
                <div className="mt-1.5 flex items-start gap-2 text-[14px] text-ok">
                  <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
                  <RichLines lines={rightAnswer(wq)} />
                </div>
                {g && g.answer && (
                  <div className="mt-1 flex items-start gap-2 text-[13px] text-ink-3">
                    <X className="mt-0.5 size-4 shrink-0 text-danger" /> <span className="line-through decoration-danger/50">{g.answer}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[1100px] content-start gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Tutor say={say} mood={mood} blobRef={blobRef} size={150} side="auto" accessory="glasses" />
      </aside>
      <div className="min-w-0 max-w-[760px]">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          <span className="tabular-nums">{t.quiz.question(index + 1, questions.length)}</span>
          {q.card.context && (
            <>
              <span className="text-line-2">·</span>
              <span className="truncate normal-case tracking-normal">{q.card.context}</span>
            </>
          )}
        </div>
        <motion.div key={q.id + index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
          <h1 className="text-balance font-display text-[22px] font-bold leading-tight tracking-[-0.015em] sm:text-[26px]">
            {q.ask === "column" ? t.quiz.ask.column(q.column ?? "") : t.quiz.ask[q.ask]}
          </h1>
          <Prompt q={q} />
          <Answer q={q} current={current} onAnswer={answerWith} />
          {current && <Feedback q={q} given={current} onNext={next} last={index + 1 >= questions.length} />}
        </motion.div>
      </div>
    </div>
  );
}

function Prompt({ q }: { q: Question }) {
  const big = q.prompt.map(plain).join(" ").length < 60;
  return (
    <div className="mt-4 rounded-2xl border border-line bg-raised px-5 py-5 shadow-card sm:px-6">
      <div className={cn("text-ink", big ? "font-display text-[22px] font-semibold leading-snug sm:text-[24px]" : "text-[16.5px] leading-relaxed")}>
        <RichLines lines={q.prompt} list={q.prompt.length > 2} />
      </div>
      {q.kind === "truefalse" && (
        <div className="mt-3 rounded-xl border-l-[3px] border-blob bg-blob-soft/40 px-4 py-3 text-[15.5px] leading-relaxed text-ink">
          <RichLines lines={q.statement} list={q.statement.length > 2} />
        </div>
      )}
    </div>
  );
}

function Answer({ q, current, onAnswer }: { q: Question; current: Given | null; onAnswer: (g: Given) => void }) {
  const t = useMessages(studyText);
  const [typed, setTyped] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (q.kind === "type") input.current?.focus();
  }, [q]);

  if (q.kind === "choice") {
    const chosen = current ? q.options.findIndex((o) => plain(o) === current.answer) : -1;
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const right = current && i === q.correct;
          const wrong = current && i === chosen && i !== q.correct;
          return (
            <button
              key={i}
              disabled={Boolean(current)}
              onClick={() => onAnswer({ correct: i === q.correct, answer: plain(o) })}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] leading-snug shadow-card transition-[border-color,background,transform] active:scale-[0.99]",
                right ? "border-ok bg-ok/10 text-ink" : wrong ? "border-danger/60 bg-danger/8 text-ink" : "border-line bg-raised text-ink hover:border-blob/40",
                current && !right && !wrong && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg border text-[12.5px] font-semibold",
                  right ? "border-ok bg-ok text-white" : wrong ? "border-danger bg-danger text-white" : "border-line bg-surface text-ink-3",
                )}
              >
                {right ? <Check className="size-4" strokeWidth={3} /> : wrong ? <X className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <RichLine line={o} mathSize="sm" />
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.kind === "truefalse") {
    const said = current?.answer;
    const options = [
      { value: true, label: t.quiz.true, key: "1" },
      { value: false, label: t.quiz.false, key: "2" },
    ];
    return (
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const right = current && o.value === q.truth;
          const wrong = current && said === o.label && o.value !== q.truth;
          return (
            <button
              key={o.label}
              disabled={Boolean(current)}
              onClick={() => onAnswer({ correct: o.value === q.truth, answer: o.label })}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-2xl border text-[15px] font-semibold shadow-card transition-[border-color,background,transform] active:scale-[0.99]",
                right ? "border-ok bg-ok/10 text-ok" : wrong ? "border-danger/60 bg-danger/8 text-danger" : "border-line bg-raised text-ink hover:border-blob/40",
                current && !right && !wrong && "opacity-55",
              )}
            >
              {o.value ? <Check className="size-4.5" strokeWidth={2.6} /> : <X className="size-4.5" strokeWidth={2.6} />}
              {o.label}
              <kbd className="hidden rounded-md border border-line px-1.5 text-[11px] font-medium text-ink-3 pointer-fine:inline">{o.key}</kbd>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (current || !typed.trim()) return;
        const verdict = sameAnswer(typed, q.answer);
        onAnswer({ correct: Boolean(verdict), close: verdict === "close", answer: typed.trim() });
      }}
    >
      <input
        ref={input}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        disabled={Boolean(current)}
        placeholder={t.quiz.typePlaceholder}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cn(
          "h-13 min-w-0 flex-1 rounded-2xl border bg-raised px-4 text-[16px] text-ink shadow-card outline-none transition-[border,box-shadow] placeholder:text-ink-3/80 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)]",
          current ? (current.correct ? "border-ok" : "border-danger/60") : "border-line",
        )}
      />
      {!current && (
        <div className="flex gap-2">
          <button type="submit" disabled={!typed.trim()} className="h-13 flex-1 rounded-2xl bg-ink px-5 text-[15px] font-semibold text-paper transition-[transform,opacity] hover:bg-ink/88 active:scale-[0.98] disabled:opacity-40 sm:flex-none">
            {t.quiz.check}
          </button>
          <button type="button" onClick={() => onAnswer({ correct: false, answer: "" })} className="h-13 rounded-2xl px-4 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            {t.quiz.dontKnow}
          </button>
        </div>
      )}
    </form>
  );
}

/** The right answer to a question, as lines. */
function rightAnswer(q: Question): Line[] {
  if (q.kind === "choice") return [q.options[q.correct]];
  if (q.kind === "type") return [[{ text: q.answer }]];
  return q.card.source === "cloze" ? [[{ text: q.card.answer ?? "" }]] : q.card.back;
}

function Feedback({ q, given, onNext, last }: { q: Question; given: Given; onNext: () => void; last: boolean }) {
  const t = useMessages(studyText);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);
  const right = rightAnswer(q);
  // Right and nothing new to see (you picked it, or the statement was the answer): no need to repeat it.
  const show = !given.correct || given.close || (q.kind === "truefalse" && !q.truth);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mt-4 rounded-2xl border p-4", given.correct ? "border-ok/40 bg-ok/[0.07]" : "border-danger/30 bg-danger/[0.05]")}
      role="status"
    >
      <div className={cn("flex items-center gap-2 text-[15px] font-semibold", given.correct ? "text-ok" : "text-danger")}>
        {given.correct ? <Check className="size-4.5" strokeWidth={2.6} /> : <X className="size-4.5" strokeWidth={2.6} />}
        {given.correct ? (given.close ? t.quiz.close : t.quiz.right[0]) : t.quiz.wrong}
      </div>
      {show && (
        <div className="mt-2 text-[14px] leading-relaxed text-ink-2">
          <span className="mr-1 font-medium text-ink">{t.quiz.answer}</span>
          <span className="text-ink">
            <RichLines lines={right} list={right.length > 2} />
          </span>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <StudyButton onClick={onNext} variant={given.correct ? "blob" : "ink"} buttonRef={nextRef}>
          {last ? t.quiz.results : t.quiz.next} <ArrowRight className="size-4" />
        </StudyButton>
      </div>
    </motion.div>
  );
}
