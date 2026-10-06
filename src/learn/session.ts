"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { DAILY_GOAL, nextMastery, record, streak, today, type LearnDay } from "./progress";

/**
 * Live state for one study session: XP, mastery, combo. Every answer is saved
 * right away, so leaving halfway through never loses progress.
 */
export function useStudySession({
  topic,
  level,
  mastery: startMastery,
  levelMastery: startLevelMastery = startMastery,
  todayXp: startToday,
}: {
  topic: string;
  /** The level being studied; it gets its own progress row next to the topic's. */
  level?: number;
  mastery: number;
  levelMastery?: number;
  todayXp: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [xp, setXp] = useState(0);
  const [mastery, setMastery] = useState(startMastery);
  const [levelMastery, setLevelMastery] = useState(startLevelMastery);
  const levelMasteryRef = useRef(startLevelMastery);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const masteryRef = useRef(startMastery);
  const comboRef = useRef(0);
  const bestRef = useRef(0);

  const answer = useCallback(
    (input: { correct: boolean; xp: number; level: number }) => {
      const m = nextMastery(masteryRef.current, input.correct, input.level);
      masteryRef.current = m;
      const lm = nextMastery(levelMasteryRef.current, input.correct, input.level);
      levelMasteryRef.current = lm;
      setLevelMastery(lm);
      comboRef.current = input.correct ? comboRef.current + 1 : 0;
      bestRef.current = Math.max(bestRef.current, comboRef.current);
      setMastery(m);
      setCombo(comboRef.current);
      setBestCombo(bestRef.current);
      setXp((x) => x + input.xp);
      setAnswered((n) => n + 1);
      if (input.correct) setCorrect((n) => n + 1);
      void record(supabase, { topic, xp: input.xp, attempts: 1, correct: input.correct ? 1 : 0, mastery: m, streak: bestRef.current, level, levelMastery: lm });
    },
    [supabase, topic, level],
  );

  /** XP without an answer (finishing a lesson). */
  const bonus = useCallback(
    (amount: number, opts: { lesson?: boolean } = {}) => {
      setXp((x) => x + amount);
      void record(supabase, {
        topic,
        xp: amount,
        attempts: 0,
        correct: 0,
        mastery: masteryRef.current,
        streak: bestRef.current,
        lesson: opts.lesson,
        level,
        levelMastery: levelMasteryRef.current,
      });
    },
    [supabase, topic, level],
  );

  return {
    xp,
    mastery,
    startMastery,
    levelMastery,
    startLevelMastery,
    combo,
    bestCombo,
    answered,
    correct,
    todayXp: startToday + xp,
    startToday,
    goal: DAILY_GOAL,
    answer,
    bonus,
  };
}

export type StudySession = ReturnType<typeof useStudySession>;

const noop = () => () => {};

/**
 * Today's date in the student's own timezone. `null` while rendering on the
 * server and hydrating, so server and client markup always agree.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noop, () => today(), () => null);
}

export function useTodayXp(days: LearnDay[]) {
  const day = useToday();
  return { day, xp: day ? (days.find((d) => d.day === day)?.xp ?? 0) : 0, streak: day ? streak(days) : 0 };
}

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Desktop layout? (Assumed on the server.) */
export function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 1024px)").matches, () => true);
}
