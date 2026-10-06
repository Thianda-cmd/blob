"use client";

import { AnimatePresence, motion, useAnimate } from "motion/react";
import { ArrowRight, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { resolveText } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { answerDisplay, check, type AnswerValue } from "@/learn/engine/answers";
import type { AnswerSpec, Exercise, Feedback } from "@/learn/types";
import { cn } from "@/lib/utils";
import { Blob } from "@/components/blob/Blob";
import { AnswerInput, type AnswerStatus } from "./AnswerInput";
import { MathView } from "./MathView";
import { Inline, Rich } from "./Rich";
import { SolutionPlayer } from "./SolutionPlayer";

export type ExerciseResult = {
  correct: boolean;
  firstTry: boolean;
  usedHint: boolean;
  revealed: boolean;
};

export type ExerciseEvent = "correct" | "wrong" | "hint" | "reveal";

/** XP for a finished exercise: full on a clean first try, halved for a second try or a hint. */
export function earnedXp(base: number, r: ExerciseResult) {
  if (!r.correct || r.revealed || !base) return 0;
  return Math.max(1, Math.round(base * (r.firstTry ? 1 : 0.5) * (r.usedHint ? 0.5 : 1)));
}

/**
 * One exercise: the task, the answer input, hint, check, retry and the animated
 * solution. Calls `onDone` when the student presses Continue.
 */
export function ExerciseCard({
  exercise,
  mode = "practice",
  level,
  xp,
  onEvent,
  onDone,
  compact,
}: {
  exercise: Exercise;
  mode?: "practice" | "test" | "lesson";
  level?: number;
  /** XP this exercise is worth on a clean first try (shown on success). */
  xp?: number;
  onEvent?: (event: ExerciseEvent, info: { feedback?: Feedback; attempt: number }) => void;
  onDone: (result: ExerciseResult) => void;
  compact?: boolean;
}) {
  const scope = useId();
  const [reported, setAnswer] = useState<AnswerValue | null>(null);
  const [status, setStatus] = useState<AnswerStatus>("idle");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [scopeRef, animate] = useAnimate();
  const continueRef = useRef<HTMLButtonElement>(null);
  const maxAttempts = mode === "test" ? 1 : 2;
  const m = useMessages(learnText);
  const t = m.exercise;
  const tt = useText();
  // Picked once so re-renders don't reshuffle the wording.
  const [praiseOffset] = useState(() => Math.floor(Math.random() * 1000));
  const [tryOffset] = useState(() => Math.floor(Math.random() * 1000));
  const praise = t.praise[praiseOffset % t.praise.length];

  useEffect(() => {
    if (done) continueRef.current?.focus();
  }, [done]);

  /** `latest` comes straight from the input on Enter; the Check button uses the reported answer. */
  function submit(latest?: AnswerValue | null) {
    if (done) return;
    const answer = latest === undefined ? reported : latest;
    if (!answer) {
      animate(scopeRef.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.35 });
      return;
    }
    const fb = check(exercise.answer, answer, { mistakes: exercise.mistakes });
    const attempt = attempts + 1;
    setAttempts(attempt);
    setFeedback(fb);
    if (fb.correct) {
      setStatus("correct");
      setDone(true);
      onEvent?.("correct", { feedback: fb, attempt });
      return;
    }
    setStatus("wrong");
    animate(scopeRef.current, { x: [0, -10, 10, -6, 6, 0] }, { duration: 0.4 });
    onEvent?.("wrong", { feedback: fb, attempt });
    if (attempt >= maxAttempts && (!fb.partial || mode === "test")) reveal();
  }

  function reveal() {
    setRevealed(true);
    setDone(true);
    onEvent?.("reveal", { attempt: attempts + 1 });
  }

  function retry() {
    setStatus("idle");
    setFeedback(null);
  }

  const result: ExerciseResult = { correct: status === "correct", firstTry: status === "correct" && attempts === 1, usedHint: hint, revealed };
  const earned = earnedXp(xp ?? 0, result);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-blob-ink">{tt(exercise.instruction)}</span>
        {level && (
          <span className="flex gap-0.5" title={m.level(level)}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={cn("size-1.5 rounded-full", n <= level ? "bg-blob" : "bg-line-2")} />
            ))}
          </span>
        )}
      </div>

      {exercise.text && <Rich text={exercise.text} className="max-w-[640px] text-[16.5px] leading-relaxed text-ink" />}

      {exercise.math && (
        <div className={cn("relative grid place-items-center overflow-x-auto rounded-2xl border border-line bg-surface px-6", compact ? "min-h-[110px] py-6" : "min-h-[150px] py-9")}>
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
          <MathView src={exercise.math} size={compact ? "lg" : "xl"} scope={scope} className="relative" />
        </div>
      )}

      {exercise.visual && (
        <div className="rounded-2xl border border-line bg-surface p-3">
          <exercise.visual.component {...exercise.visual.props} />
        </div>
      )}

      <div ref={scopeRef}>
        <AnswerInput spec={exercise.answer} onChange={setAnswer} onSubmit={submit} status={status} disabled={done} />
      </div>

      <AnimatePresence>
        {hint && exercise.hint && !done && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2.5 rounded-xl border border-blob/25 bg-blob-soft/50 px-4 py-3 text-[14px] text-ink">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-blob-ink" />
              <Rich text={exercise.hint} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!done && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => submit()}
            className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[14.5px] font-semibold text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition-transform hover:bg-ink/88 active:scale-[0.97]"
          >
            {t.check} <span className="text-[11px] font-normal opacity-60">{t.enter}</span>
          </button>
          {mode !== "test" && exercise.hint && !hint && (
            <button
              onClick={() => {
                setHint(true);
                onEvent?.("hint", { attempt: attempts });
              }}
              className="flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
            >
              <Lightbulb className="size-4" /> {t.hint}
            </button>
          )}
          {mode !== "test" && attempts > 0 && status === "wrong" && (
            <>
              <button onClick={retry} className="flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                <RotateCcw className="size-4" /> {t.tryAgain}
              </button>
              <button onClick={reveal} className="flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                {t.showSolution}
              </button>
            </>
          )}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {feedback && status === "wrong" && (
          <BlobNotice
            key={`${attempts}`}
            feedback={feedback}
            fallback={t.tryAgainLines[(tryOffset + attempts) % t.tryAgainLines.length]}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn("space-y-4 rounded-2xl border p-4 sm:p-5", status === "correct" ? "border-ok/30 bg-ok/[0.06]" : "border-line bg-raised")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 14 }}
                className={cn("grid size-9 place-items-center rounded-full text-white", status === "correct" ? "bg-ok" : "bg-ink-3")}
              >
                {status === "correct" ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
              </motion.span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[18px] font-semibold">{status === "correct" ? praise : t.howItWorks}</div>
                {status !== "correct" && (
                  <div className="flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
                    {t.answer}{" "}
                    <Solution spec={exercise.answer} />
                  </div>
                )}
              </div>
              {earned > 0 && (
                <motion.span
                  initial={{ opacity: 0, y: 8, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 20 }}
                  className="rounded-full bg-blob px-3 py-1 text-[13px] font-semibold text-white"
                >
                  +{earned} XP
                </motion.span>
              )}
              <button
                ref={continueRef}
                onClick={() => onDone(result)}
                className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[14.5px] font-semibold text-paper transition-transform hover:bg-ink/88 active:scale-[0.97]"
              >
                {t.continue} <ArrowRight className="size-4" />
              </button>
            </div>
            {(revealed || status === "wrong") && <SolutionPlayer frames={exercise.solution} size={compact ? "md" : "lg"} />}
            {status === "correct" && exercise.solution.length > 1 && !compact && (
              <details className="group text-[13.5px] text-ink-2">
                <summary className="cursor-pointer select-none hover:text-ink">{t.workedSolution}</summary>
                <div className="mt-3">
                  <SolutionPlayer frames={exercise.solution} size="md" autoPlay={false} />
                </div>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Blob's note right under the answer: what it thinks happened, with the student's own
 * answer shown and the spots that matter highlighted.
 */
function BlobNotice({ feedback, fallback }: { feedback: Feedback; fallback: string }) {
  const t = useMessages(learnText).exercise;
  const tt = useText();
  const close = Boolean(feedback.partial);
  const message = feedback.message ? tt(feedback.message) : fallback;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={cn("flex gap-3 rounded-2xl border p-3.5 sm:p-4", close ? "border-blob/30 bg-blob-soft/40" : "border-danger/25 bg-danger/[0.05]")}
      role="status"
    >
      <div className="-my-1 shrink-0">
        <Blob size={46} mood={close ? "thinking" : "worried"} interactive={false} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className={cn("text-[13.5px] font-semibold", close ? "text-blob-ink" : "text-danger")}>
          {feedback.title ? tt(feedback.title) : t.notQuite}
        </div>
        {feedback.mark && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
            <span>{t.yourAnswer}</span>
            <MathView src={feedback.mark} size="md" animate={false} className="text-ink" />
          </div>
        )}
        <p className="text-[14.5px] leading-relaxed text-ink">
          <Inline text={message} />
        </p>
      </div>
    </motion.div>
  );
}

/** The right answer, shown after a wrong attempt. */
function Solution({ spec }: { spec: AnswerSpec }) {
  const locale = useLocale();
  if (spec.kind === "choice") {
    return (
      <span className="font-medium text-ink">
        <Inline text={spec.options[spec.correct]} />
      </span>
    );
  }
  if (spec.kind === "multi") {
    return (
      <span className="flex flex-wrap gap-1.5">
        {spec.correct.map((i) => (
          <span key={i} className="rounded-lg border border-line bg-raised px-2 py-0.5 font-medium text-ink">
            <Inline text={spec.options[i]} />
          </span>
        ))}
      </span>
    );
  }
  if (spec.kind === "word") return <span className="font-medium text-ink">{resolveText(spec.accept[0], locale)}</span>;
  if (spec.kind === "order") {
    return (
      <ol className="flex flex-wrap items-center gap-1.5">
        {spec.items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-3">→</span>}
            <span className="rounded-lg border border-line bg-raised px-2 py-0.5 font-medium text-ink">
              <Inline text={item} />
            </span>
          </li>
        ))}
      </ol>
    );
  }
  if (spec.kind === "match") {
    return (
      <ul className="grid gap-1">
        {spec.pairs.map(([left, right], i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">
              <Inline text={left} />
            </span>
            <span className="text-ink-3">→</span>
            <span className="rounded-lg border border-line bg-raised px-2 py-0.5 text-ink">
              <Inline text={right} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return <MathView src={answerDisplay(spec, locale) || "–"} size="sm" animate={false} className="text-ink" />;
}
