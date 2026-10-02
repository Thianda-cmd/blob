"use client";

import { AnimatePresence, motion, useAnimate } from "motion/react";
import { ArrowRight, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { answerDisplay, check, type AnswerValue } from "@/learn/engine/answers";
import type { Exercise, Feedback } from "@/learn/types";
import { cn } from "@/lib/utils";
import { AnswerInput, type AnswerStatus } from "./AnswerInput";
import { MathView } from "./MathView";
import { Rich } from "./Rich";
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
  const locale = useLocale();
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
    const fb = check(exercise.answer, answer);
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

      <AnimatePresence>
        {feedback && !done && status === "wrong" && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[14px] text-danger">
            {feedback.message ? tt(feedback.message) : t.tryAgainLines[(tryOffset + attempts) % t.tryAgainLines.length]}
          </motion.p>
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
                    {t.answer} <MathView src={answerDisplay(exercise.answer, locale) || "–"} size="sm" animate={false} className="text-ink" />
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
