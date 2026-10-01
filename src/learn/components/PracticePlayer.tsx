"use client";

import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { BlobHandle, BlobMood } from "@/components/blob/Blob";
import { createRng } from "@/learn/engine/rng";
import { levelFor, type LearnDay } from "@/learn/progress";
import { useStudySession, useTodayXp, useWide } from "@/learn/session";
import { getTopic } from "@/learn/topics";
import type { Exercise, Feedback, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";
import { earnedXp, ExerciseCard, type ExerciseEvent, type ExerciseResult } from "./ExerciseCard";
import { SessionEnd, StudyButton, StudyTopBar, type SegmentState } from "./StudyChrome";
import { Tutor } from "./Tutor";

const ROUND = 10;
/** A quick test climbs from easy to hard. */
const TEST_LEVELS: Level[] = [1, 1, 2, 2, 2, 3, 3, 3];

const CHEERS = ["Yes!", "Correct!", "Nice one.", "Exactly!", "You're on fire!", "Too easy for you?"];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

const xpFor = (level: Level) => 6 + level * 4;

/** Generate an exercise, avoiding repeats within the round. */
function make(topic: Topic, level: Level, seed: number, avoid: string[]): Exercise {
  let ex = topic.generate(level, createRng(seed));
  for (let n = 1; n < 10 && avoid.includes(sig(ex)); n++) ex = topic.generate(level, createRng(seed + n * 104729));
  return ex;
}
const sig = (ex: Exercise) => `${ex.math ?? ""}|${ex.text ?? ""}|${JSON.stringify(ex.answer)}|${JSON.stringify(ex.visual?.props ?? null)}`;

/** German school grades, the scale students know. */
function grade(pct: number): { n: number; label: string } {
  if (pct >= 0.92) return { n: 1, label: "Excellent" };
  if (pct >= 0.81) return { n: 2, label: "Good" };
  if (pct >= 0.67) return { n: 3, label: "Satisfactory" };
  if (pct >= 0.5) return { n: 4, label: "Sufficient" };
  if (pct >= 0.3) return { n: 5, label: "Poor" };
  return { n: 6, label: "Not yet" };
}

/** Practice round (adaptive, hints, retries) or a quick test (one try, graded). */
export function PracticePlayer({
  slug,
  mode,
  level: forced,
  mastery,
  days,
  seed,
}: {
  slug: string;
  mode: "practice" | "test";
  level?: Level;
  mastery: number;
  days: LearnDay[];
  seed: number;
}) {
  const topic = getTopic(slug)!;
  const router = useRouter();
  const wide = useWide();
  const today = useTodayXp(days);
  const session = useStudySession({ topic: slug, mastery, todayXp: today.xp });
  const blobRef = useRef<BlobHandle>(null);
  const test = mode === "test";
  const total = test ? TEST_LEVELS.length : ROUND;
  const firstLevel = test ? TEST_LEVELS[0] : (forced ?? levelFor(mastery));

  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState<Level>(firstLevel);
  const [history, setHistory] = useState<string[]>([]);
  const [exercise, setExercise] = useState(() => make(topic, firstLevel, seed, []));
  const [results, setResults] = useState<SegmentState[]>(() => Array.from({ length: total }, (_, i) => (i === 0 ? "current" : "todo")));
  const [roundStats, setRoundStats] = useState({ right: 0, xp: 0, startXp: 0 });
  const [streakUp, setStreakUp] = useState(0);
  const [streakDown, setStreakDown] = useState(0);
  const [finished, setFinished] = useState(false);
  const [mood, setMood] = useState<BlobMood>("happy");
  const [say, setSay] = useState<string | null>(
    test ? `Quick test: ${total} tasks, one try each, no hints. You've got this!` : `Let's practise! ${ROUND} tasks, they adapt to you.`,
  );
  const exitHref = `/learn/maths/${slug}`;

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") router.push(exitHref);
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
      if (session.combo + 1 >= 3) b?.celebrate();
      else b?.jump(0.7);
      setSay(session.combo + 1 >= 3 ? `${session.combo + 1} in a row! ${pick(CHEERS)}` : pick(CHEERS));
    } else if (event === "wrong") {
      setMood("worried");
      b?.shake();
      setSay(test ? "Not this time. Let's see how it works." : (feedback?.message ?? "Not quite. Have another look!"));
    } else if (event === "hint") {
      setMood("thinking");
      setSay("A little nudge for you.");
    } else {
      setMood("thinking");
      setSay("Watch the steps. Next time you'll have it.");
    }
  }

  function done(r: ExerciseResult) {
    const right = r.correct && !r.revealed;
    const xp = earnedXp(xpFor(level), r);
    session.answer({ correct: right, xp, level });
    setRoundStats((s) => ({ ...s, right: s.right + (right ? 1 : 0), xp: s.xp + xp }));

    const nextIndex = index + 1;
    setResults((list) => list.map((s, i) => (i === index ? (right ? "ok" : "bad") : i === nextIndex ? "current" : s)));
    if (nextIndex >= total) {
      setFinished(true);
      return;
    }

    // Adapt: two clean answers in a row → harder; two misses → easier.
    let nextLevel = level;
    let line: string | null = null;
    if (test) nextLevel = TEST_LEVELS[nextIndex];
    else {
      const clean = right && r.firstTry && !r.usedHint;
      const up = clean ? streakUp + 1 : 0;
      const down = right ? 0 : streakDown + 1;
      if (up >= 2 && level < 3) {
        nextLevel = (level + 1) as Level;
        line = `Level up! Level ${nextLevel} now.`;
        setStreakUp(0);
      } else setStreakUp(up);
      if (down >= 2 && level > 1) {
        nextLevel = (level - 1) as Level;
        line = "Let's take a small step back and build it up again.";
        setStreakDown(0);
      } else setStreakDown(down);
    }
    const nextHistory = [...history, sig(exercise)];
    setHistory(nextHistory);
    setLevel(nextLevel);
    setExercise(make(topic, nextLevel, seed + round * 7919 + nextIndex * 31, nextHistory));
    setIndex(nextIndex);
    setMood("happy");
    setSay(line);
    if (line?.startsWith("Level up")) blobRef.current?.jump(1);
  }

  function restart() {
    const r = round + 1;
    const lvl = test ? TEST_LEVELS[0] : levelFor(session.mastery);
    setRound(r);
    setIndex(0);
    setLevel(lvl);
    setHistory([]);
    setExercise(make(topic, lvl, seed + r * 7919, []));
    setResults(Array.from({ length: total }, (_, i) => (i === 0 ? "current" : "todo")));
    setRoundStats({ right: 0, xp: 0, startXp: session.xp });
    setStreakUp(0);
    setStreakDown(0);
    setFinished(false);
    setMood("happy");
    setSay(test ? "Another test? Let's go!" : "Another round, let's go!");
  }

  if (finished) {
    const pct = roundStats.right / total;
    const g = grade(pct);
    return (
      <div className="min-h-dvh">
        <StudyTopBar exitHref={exitHref} title={topic.title} segments={results} xp={session.xp} />
        <SessionEnd
          title={test ? (g.n <= 2 ? "Test passed with flying colours!" : g.n <= 4 ? "Test done!" : "Test done. Keep practising!") : pct >= 0.7 ? "Round complete!" : "Round done. Good effort!"}
          subtitle={`${topic.title} · ${topic.de}`}
          happy={pct >= 0.5}
          badge={
            test ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 18 }}
                className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-card"
              >
                <span className={cn("grid size-16 place-items-center rounded-2xl font-display text-[34px] font-bold text-white", g.n <= 2 ? "bg-ok" : g.n <= 4 ? "bg-blob" : "bg-ink-3")}>
                  {g.n}
                </span>
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Grade</div>
                  <div className="font-display text-[22px] font-semibold">{g.label}</div>
                  <div className="text-[13px] text-ink-2">{Math.round(pct * 100)}% correct</div>
                </div>
              </motion.div>
            ) : undefined
          }
          stats={[
            { label: "XP earned", value: roundStats.xp, tone: "blob" },
            { label: "Correct", value: roundStats.right, suffix: ` / ${total}`, tone: "ok" },
            { label: "Best streak", value: session.bestCombo },
          ]}
          mastery={{ from: session.startMastery, to: session.mastery }}
          today={{ from: session.startToday, to: session.todayXp, goal: session.goal }}
        >
          <StudyButton onClick={restart} variant="blob">
            <RotateCcw className="size-4" /> {test ? "Take another test" : "Another round"}
          </StudyButton>
          <StudyButton href={exitHref} variant="ghost">
            Back to topic
          </StudyButton>
        </SessionEnd>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <StudyTopBar exitHref={exitHref} title={test ? `${topic.title} · Test` : topic.title} segments={results} xp={session.xp} combo={session.combo} />
      <div className="mx-auto grid w-full max-w-[1360px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Tutor say={say} mood={mood} blobRef={blobRef} size={wide ? 170 : 84} side={wide ? "left" : "top"} />
        </aside>
        <main className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            <span>
              Task {index + 1} of {total}
            </span>
            <span className="text-line-2">·</span>
            <span className="text-blob-ink">{test ? "Test" : `Level ${level}`}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={`${round}-${index}`}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -36 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className="max-w-[920px]"
            >
              <ExerciseCard exercise={exercise} mode={mode} level={level} xp={xpFor(level)} onEvent={(e, info) => react(e, info.feedback)} onDone={done} />
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
