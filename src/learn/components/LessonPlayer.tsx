"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Dumbbell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { BlobHandle, BlobMood } from "@/components/blob/Blob";
import type { LearnDay } from "@/learn/progress";
import { useStudySession, useTodayXp, useWide } from "@/learn/session";
import { getTopic } from "@/learn/topics";
import type { Feedback, LessonStep } from "@/learn/types";
import { cn } from "@/lib/utils";
import { earnedXp, ExerciseCard, type ExerciseEvent } from "./ExerciseCard";
import { MathView } from "./MathView";
import { Inline, Rich } from "./Rich";
import { SessionEnd, StudyButton, StudyTopBar } from "./StudyChrome";
import { Tutor } from "./Tutor";

const LESSON_XP = 20;
const CHECK_XP = 10;

const CHEERS = ["Yes! Exactly.", "You got it!", "Perfect!", "Brilliant, that's right.", "Look at you go!"];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

function openingLine(step: LessonStep) {
  if (step.blob) return step.blob;
  if (step.type === "check") return "Your turn! Give it a try.";
  if (step.type === "widget") return "Play with this a bit!";
  return "Let's look at this together.";
}

/** A guided lesson: animated explanations, small interactive pieces and checks, with Blob as the tutor. */
export function LessonPlayer({ slug, mastery, days }: { slug: string; mastery: number; days: LearnDay[] }) {
  const topic = getTopic(slug)!;
  const steps = topic.lesson;
  const router = useRouter();
  const scope = useId();
  const today = useTodayXp(days);
  const session = useStudySession({ topic: slug, mastery, todayXp: today.xp });
  const blobRef = useRef<BlobHandle>(null);
  const wide = useWide();

  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [finished, setFinished] = useState(false);
  const [say, setSay] = useState<string | null>(openingLine(steps[0]));
  const [mood, setMood] = useState<BlobMood>("happy");
  const [dir, setDir] = useState(1);

  const step = steps[index];
  const frames = step.type === "explain" ? (step.frames ?? []) : [];
  const exitHref = `/learn/maths/${slug}`;
  const progress = finished ? 1 : (index + (frames.length > 1 ? frame / frames.length : 0)) / steps.length;
  const canBack = frame > 0 || (index > 0 && steps[index - 1].type !== "check" && step.type !== "check");

  function goTo(to: number, d: number) {
    setDir(d);
    setIndex(to);
    const target = steps[to];
    setFrame(d < 0 && target.type === "explain" && target.frames ? target.frames.length - 1 : 0);
    setMood("happy");
    setSay(openingLine(target));
  }

  function next() {
    if (finished) return;
    if (frames.length && frame < frames.length - 1) {
      setFrame((f) => f + 1);
      blobRef.current?.point();
      return;
    }
    if (index < steps.length - 1) {
      goTo(index + 1, 1);
      return;
    }
    session.bonus(LESSON_XP, { lesson: true });
    setFinished(true);
  }

  function back() {
    if (frame > 0) setFrame((f) => f - 1);
    else if (canBack) goTo(index - 1, -1);
  }

  // Keyboard: → / Enter next, ← back, Esc leave. Checks handle their own keys.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      router.push(exitHref);
      return;
    }
    if (finished || step.type === "check" || e.defaultPrevented) return;
    const el = document.activeElement as HTMLElement | null;
    // Widgets own their keys: sliders, inputs and anything inside a control.
    const busy = el?.closest("input, textarea, select, [contenteditable], [role=slider], [role=spinbutton], [data-own-keys]");
    if (busy) return;
    if (e.key === "ArrowRight" || (e.key === "Enter" && (!el || el === document.body))) {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      back();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function react(event: ExerciseEvent, feedback?: Feedback) {
    const b = blobRef.current;
    if (event === "correct") {
      setMood("excited");
      b?.celebrate();
      setSay(pick(CHEERS));
    } else if (event === "wrong") {
      setMood("worried");
      b?.shake();
      setSay(feedback?.message ?? "Not quite. Have another look!");
    } else if (event === "hint") {
      setMood("thinking");
      setSay("Here's a little hint for you.");
    } else {
      setMood("thinking");
      setSay("No problem! Watch how it works, then carry on.");
    }
  }

  if (finished) {
    return (
      <div className="min-h-dvh">
        <StudyTopBar exitHref={exitHref} title={topic.title} progress={1} xp={session.xp} />
        <SessionEnd
          title="Lesson complete!"
          subtitle={`${topic.title} · ${topic.de}. Now make it stick with a few practice tasks.`}
          stats={[
            { label: "XP earned", value: session.xp, tone: "blob" },
            { label: "Checks right", value: session.correct, suffix: ` / ${session.answered}`, tone: "ok" },
            { label: "Steps", value: steps.length },
          ]}
          mastery={{ from: session.startMastery, to: session.mastery }}
          today={{ from: session.startToday, to: session.todayXp, goal: session.goal }}
        >
          <StudyButton href={`/study/maths/${slug}/practice`} variant="blob">
            <Dumbbell className="size-4" /> Practice now
          </StudyButton>
          <StudyButton href={exitHref} variant="ghost">
            Back to topic
          </StudyButton>
        </SessionEnd>
      </div>
    );
  }

  const f = frames[Math.min(frame, frames.length - 1)];

  return (
    <div className="flex min-h-dvh flex-col">
      <StudyTopBar exitHref={exitHref} title={topic.title} progress={progress} xp={session.xp} combo={session.combo} />
      <div className="mx-auto grid w-full max-w-[1360px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Tutor say={say} mood={mood} blobRef={blobRef} size={wide ? 170 : 84} side={wide ? "left" : "top"} />
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            <span>
              Step {index + 1} of {steps.length}
            </span>
            <span className="text-line-2">·</span>
            <span className="text-blob-ink">{step.type === "check" ? "Your turn" : step.type === "widget" ? "Try it" : "Learn"}</span>
          </div>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={index}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 36 * d }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: -36 * d }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className="max-w-[920px] space-y-5"
            >
              {step.type === "check" ? (
                <>
                  {step.title && <h1 className="font-display text-[26px] font-bold tracking-[-0.015em]">{step.title}</h1>}
                  <ExerciseCard
                    exercise={step.exercise}
                    mode="lesson"
                    xp={CHECK_XP}
                    onEvent={(e, info) => react(e, info.feedback)}
                    onDone={(r) => {
                      session.answer({ correct: r.correct && !r.revealed, xp: earnedXp(CHECK_XP, r), level: 1 });
                      next();
                    }}
                  />
                </>
              ) : (
                <>
                  <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.015em] sm:text-[30px]">{step.title}</h1>
                  {step.body && <Rich text={step.body} className="max-w-[700px] text-[16px] leading-relaxed text-ink-2" />}

                  {step.type === "widget" && (
                    <div className="rounded-2xl border border-line bg-raised p-4 shadow-card sm:p-6">
                      <step.widget />
                    </div>
                  )}

                  {f && (
                    <div className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
                      <div className="relative grid min-h-[200px] place-items-center overflow-x-auto px-6 py-12 sm:min-h-[240px]">
                        <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
                        <MathView src={f.math} size="xl" highlight={f.highlight} arrows={f.arrows} scope={`${scope}-${index}`} className="relative" />
                      </div>
                      <div className="flex items-start gap-3 border-t border-line bg-surface/60 px-5 py-4">
                        {frames.length > 1 && (
                          <div className="mt-1.5 flex shrink-0 gap-1">
                            {frames.map((_, n) => (
                              <button
                                key={n}
                                onClick={() => setFrame(n)}
                                className={cn("h-1.5 rounded-full transition-all", n === frame ? "w-5 bg-blob" : n < frame ? "w-1.5 bg-blob/50" : "w-1.5 bg-line-2")}
                                aria-label={`Show step ${n + 1}`}
                              />
                            ))}
                          </div>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.p
                            key={frame}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                            className="min-h-[1.5em] text-[15.5px] leading-relaxed text-ink"
                          >
                            {f.note ? <Inline text={f.note} /> : null}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <StudyButton onClick={next} variant={frames.length && frame < frames.length - 1 ? "ink" : "blob"}>
                      {frames.length && frame < frames.length - 1 ? "Next" : index === steps.length - 1 ? "Finish lesson" : "Continue"}
                      <ArrowRight className="size-4" />
                    </StudyButton>
                    {canBack && (
                      <StudyButton onClick={back} variant="ghost">
                        <ArrowLeft className="size-4" /> Back
                      </StudyButton>
                    )}
                    <span className="ml-auto hidden text-[12px] text-ink-3 sm:block">Use ← → to step through</span>
                  </div>
                </>
              )}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
