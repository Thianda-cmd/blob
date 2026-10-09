"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { resolveText } from "@/i18n/text";
import { SessionEnd, StudyButton, StudyTopBar } from "@/learn/components/StudyChrome";
import { DAILY_GOAL, record, today as todayKey, type LearnDay } from "@/learn/progress";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ALL_WORDS, learnedPart, lessonKey, unitBySlug, UNITS } from "../course";
import { lessonExercises, practiceExercises, wordsOf } from "../generate";
import { frenchVoiceReady, prefs, sounds, stopSpeaking } from "../speech";
import { nounIndex } from "../text";
import type { Exercise, Lang, Unit } from "../types";
import { BlankEx, ChoiceEx, DialogueEx, IntroEx, ListenEx, MatchEx, PictureEx, SentenceEx, SpeakEx, speakingPossible, type ExProps } from "./exercises";
import { BlobSays, Bold, Marked, type Outcome } from "./parts";

/** Exercises that come back at the end of the lesson when they went wrong. */
const RETRY = new Set(["picture", "tiles", "type", "choice", "listen", "blank"]);

type Props =
  | { mode: "lesson"; unit: string; lesson: number; seed: number; days: LearnDay[]; doneBefore: number; replay: boolean }
  | { mode: "practice"; units: { slug: string; upTo: number }[]; weak: string[]; seed: number; days: LearnDay[] };

const pickOne = <T,>(list: readonly T[], seed: number) => list[seed % list.length];

/**
 * A French lesson or practice round: one exercise after the other, Blob reacting to every answer,
 * missed ones coming back at the end, then XP, word strength and a celebration.
 */
export function FrenchPlayer(props: Props) {
  const t = useMessages(frenchText);
  const locale = useLocale();
  const lang: Lang = locale;
  const unit = props.mode === "lesson" ? (unitBySlug(props.unit) as Unit) : null;
  const nouns = useMemo(() => nounIndex(ALL_WORDS), []);
  const exitHref = "/learn/french";

  const [queue, setQueue] = useState<Exercise[] | null>(null);
  const [voice, setVoice] = useState(false);
  const [idx, setIdx] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [ready, setReady] = useState(false);
  const [combo, setCombo] = useState(0);
  const [sound, setSound] = useState(true);
  const [done, setDone] = useState<null | { xp: number; accuracy: number; seconds: number; saved: boolean }>(null);
  const [splash, setSplash] = useState(true);

  const check = useRef<(() => Outcome) | null>(null);
  const blob = useRef<BlobHandle>(null);
  const stats = useRef({ answered: 0, right: 0, maxCombo: 0, started: 0, words: new Map<string, { ok: number; bad: number }>() });

  // Build the lesson in the browser: which exercises fit depends on its voices and microphone.
  useEffect(() => {
    let alive = true;
    void frenchVoiceReady().then((hasVoice) => {
      if (!alive) return;
      const listening = hasVoice && !prefs.listeningOff();
      const opts = { lang, seed: props.seed, listening, speaking: speakingPossible() };
      const list =
        props.mode === "lesson"
          ? lessonExercises(unit!, props.lesson, UNITS.filter((u) => u.n < unit!.n), opts)
          : practiceExercises(
              props.units.flatMap(({ slug, upTo }) => {
                const u = unitBySlug(slug);
                return u ? [learnedPart(u, upTo)] : [];
              }),
              props.weak,
              opts,
            );
      setVoice(hasVoice);
      setSound(prefs.soundOn());
      setQueue(list);
      stats.current.started = Date.now();
    });
    return () => {
      alive = false;
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once per visit
  }, []);

  useEffect(() => {
    if (!queue) return;
    const id = setTimeout(() => setSplash(false), 1300);
    return () => clearTimeout(id);
  }, [queue]);

  const ex = queue?.[idx] ?? null;

  const setCheck = useCallback((fn: (() => Outcome) | null) => {
    check.current = fn;
    setReady(!!fn);
  }, []);

  const apply = useCallback(
    (o: Outcome) => {
      if (!queue || !ex || outcome) return;
      stopSpeaking();
      if (ex.kind === "intro") {
        next();
        return;
      }
      setOutcome(o);
      const s = stats.current;
      const first = !ex.key.endsWith(":again");
      if (!o.skipped) {
        if (first) {
          s.answered++;
          if (o.correct) s.right++;
        }
        for (const w of wordsOf(ex)) {
          const e = s.words.get(w.id) ?? { ok: 0, bad: 0 };
          if (o.correct) e.ok++;
          else e.bad++;
          s.words.set(w.id, e);
        }
      }
      const nextCombo = o.skipped ? combo : o.correct ? combo + 1 : 0;
      setCombo(nextCombo);
      s.maxCombo = Math.max(s.maxCombo, nextCombo);
      if (prefs.soundOn() && !o.skipped) (o.correct ? sounds.right : sounds.wrong)();
      if (o.correct && !o.skipped) {
        if (nextCombo >= 3 && nextCombo % (nextCombo >= 5 ? 5 : 3) === 0) blob.current?.celebrate();
        else blob.current?.jump(0.7);
      } else if (!o.skipped) blob.current?.shake();
      if (!o.correct && first && RETRY.has(ex.kind)) setQueue((q) => [...q!, { ...ex, key: `${ex.key}:again` } as Exercise]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- next is stable enough for one answer
    [queue, ex, outcome, combo],
  );

  function runCheck() {
    if (!check.current || outcome) return;
    apply(check.current());
  }

  function next() {
    setOutcome(null);
    check.current = null;
    setReady(false);
    if (!queue) return;
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else void finish();
  }

  async function finish() {
    const s = stats.current;
    const accuracy = s.answered ? Math.round((s.right / s.answered) * 100) : 100;
    const perfect = s.answered > 0 && s.right === s.answered;
    const xp = props.mode === "lesson" ? 10 + (perfect ? 5 : 0) : 10;
    const supabase = createClient();
    const [saved] = await Promise.all([
      record(supabase, {
        topic: props.mode === "lesson" ? lessonKey(unit!, props.lesson) : "fr:practice",
        xp,
        attempts: s.answered,
        correct: s.right,
        mastery: accuracy,
        streak: s.maxCombo,
        lesson: props.mode === "lesson",
      }),
      s.words.size
        ? supabase.rpc("lang_words_record", { p_course: "fr", p_day: todayKey(), p_items: [...s.words].map(([id, v]) => ({ id, ok: v.ok, bad: v.bad })) })
        : Promise.resolve(null),
    ]);
    if (prefs.soundOn()) sounds.done();
    setDone({ xp, accuracy, seconds: Math.round((Date.now() - s.started) / 1000), saved });
  }

  // Enter checks and continues (text boxes call submit themselves).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing) return;
      if ((e.target as HTMLElement)?.closest("textarea, input, button")) return;
      e.preventDefault();
      if (outcome) next();
      else if (check.current) runCheck();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = unit ? t.meta.lesson(resolveText(unit.title, locale), props.mode === "lesson" ? props.lesson : 1) : t.meta.practice;
  const todayXp = props.days.find((d) => d.day === todayKey())?.xp ?? 0;

  if (done) {
    const unitLessons = unit?.lessons.length ?? 1;
    const before = props.mode === "lesson" ? props.doneBefore : 0;
    const after = props.mode === "lesson" && !props.replay ? Math.min(unitLessons, before + 1) : before;
    const nextHref = props.mode === "lesson" ? nextLessonHref(unit!, props.lesson) : null;
    const unitFinished = props.mode === "lesson" && !props.replay && after === unitLessons;
    return (
      <div className="min-h-dvh">
        <StudyTopBar exitHref={exitHref} title={title} progress={1} xp={done.xp} />
        <SessionEnd
          accessory="beret"
          title={unitFinished ? t.end.unitDone(resolveText(unit!.title, locale)) : props.mode === "lesson" ? t.end.title : t.end.practiceTitle}
          subtitle={done.saved ? (done.accuracy === 100 ? t.end.perfect : t.end.good) : t.end.notSaved}
          stats={[
            { label: t.end.xp, value: done.xp, suffix: "", tone: "blob" },
            { label: t.end.accuracy, value: done.accuracy, suffix: "%", tone: "ok" },
            { label: t.end.time, value: Math.max(1, Math.round(done.seconds / 60)), suffix: " min" },
          ]}
          mastery={{ from: Math.round((before / unitLessons) * 100), to: Math.round((after / unitLessons) * 100) }}
          today={{ from: todayXp, to: todayXp + done.xp, goal: DAILY_GOAL }}
        >
          {nextHref && (
            <StudyButton href={nextHref}>
              {t.end.next} <ArrowRight className="size-4" />
            </StudyButton>
          )}
          <StudyButton href={exitHref} variant={nextHref ? "ghost" : "ink"}>
            {t.end.back}
          </StudyButton>
          {props.mode === "practice" && (
            <StudyButton href={`/study/french/practice?s=${props.seed + 1}`} variant="ghost">
              {t.end.again}
            </StudyButton>
          )}
        </SessionEnd>
      </div>
    );
  }

  const progress = queue ? idx / queue.length : 0;
  const again = ex?.key.endsWith(":again") && !queue?.[idx - 1]?.key.endsWith(":again");
  const exProps = ex
    ? ({ ex, lang, voice, locked: !!outcome, setCheck, finish: apply, submit: runCheck, nouns, blobRef: blob } as unknown as ExProps<"intro">)
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <StudyTopBar exitHref={exitHref} title={title} progress={progress} xp={0} combo={combo} />
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-48 pt-5 sm:pt-8">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              prefs.setSound(!sound);
              setSound(!sound);
            }}
            className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
            aria-label={sound ? t.player.soundOff : t.player.soundOn}
            title={sound ? t.player.soundOff : t.player.soundOn}
          >
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
        {!queue ? (
          <div className="grid place-items-center gap-4 py-24 text-center text-[15px] text-ink-2">
            <Blob size={110} mood="thinking" accessory="beret" />
            {t.player.loading}
          </div>
        ) : (
          <>
            {again && <p className="mb-4 rounded-xl bg-blob-soft px-3.5 py-2 text-[14px] font-medium text-blob-ink">{t.player.retryRound}</p>}
            <AnimatePresence mode="wait">
              <motion.div key={ex!.key} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                {exProps && <ExerciseView {...exProps} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>

      {queue && ex && (
        <Footer
          outcome={outcome}
          ready={ready}
          intro={ex.kind === "intro"}
          combo={combo}
          seed={props.seed + idx}
          onCheck={runCheck}
          onNext={next}
        />
      )}

      <AnimatePresence>
        {queue && splash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 grid place-items-center bg-paper/90 backdrop-blur-sm"
            onClick={() => setSplash(false)}
          >
            <motion.div initial={{ scale: 0.7, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="flex flex-col items-center gap-3 text-center">
              <Blob size={150} mood="excited" accessory="beret" />
              <div lang="fr" className="font-display text-[30px] font-bold">
                {pickOne(t.start, props.seed).fr}
              </div>
              <div className="text-[15px] text-ink-2">{pickOne(t.start, props.seed).tr}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The right component for the exercise (each kind gets its own props type). */
function ExerciseView(p: ExProps<"intro">) {
  const ex = p.ex as Exercise;
  const as = <K extends Exercise["kind"]>() => p as unknown as ExProps<K>;
  switch (ex.kind) {
    case "intro":
      return <IntroEx {...p} />;
    case "picture":
      return <PictureEx {...as<"picture">()} />;
    case "choice":
      return <ChoiceEx {...as<"choice">()} />;
    case "tiles":
    case "type":
      return <SentenceEx {...as<"tiles">()} />;
    case "listen":
      return <ListenEx {...as<"listen">()} />;
    case "speak":
      return <SpeakEx {...as<"speak">()} />;
    case "blank":
      return <BlankEx {...as<"blank">()} />;
    case "match":
      return <MatchEx {...as<"match">()} />;
    case "dialogue":
      return <DialogueEx {...as<"dialogue">()} />;
  }
}

/** The bar at the bottom: Check, then how it went (Blob's reaction) and Continue. */
function Footer({
  outcome,
  ready,
  intro,
  combo,
  seed,
  onCheck,
  onNext,
}: {
  outcome: Outcome | null;
  ready: boolean;
  intro: boolean;
  combo: number;
  seed: number;
  onCheck: () => void;
  onNext: () => void;
}) {
  const t = useMessages(frenchText);
  const locale = useLocale();
  const good = outcome?.correct ?? false;
  const line = outcome
    ? outcome.skipped
      ? null
      : good
        ? combo >= 3 && combo % (combo >= 5 ? 5 : 3) === 0
          ? t.combo(combo)
          : pickOne(t.praise, seed)
        : pickOne(t.comfort, seed)
    : null;
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (outcome) button.current?.focus({ preventScroll: true });
  }, [outcome]);

  return (
    <motion.footer
      layout
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t-2 pb-[env(safe-area-inset-bottom)] transition-colors",
        !outcome ? "border-line bg-paper" : outcome.skipped ? "border-line bg-surface" : good ? "border-ok/40 bg-[color-mix(in_oklab,var(--ok)_12%,var(--paper))]" : "border-danger/40 bg-[color-mix(in_oklab,var(--danger)_10%,var(--paper))]",
      )}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:gap-5 sm:py-5">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {outcome && !outcome.skipped && (
              <motion.div key="fb" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                <div className="-mb-1 -mt-2 hidden shrink-0 sm:block">
                  <Blob size={64} mood={good ? "excited" : "worried"} accessory="beret" interactive={false} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className={cn("flex items-center gap-2 font-display text-[21px] font-bold", good ? "text-ok" : "text-danger")}>
                    <span className={cn("grid size-7 place-items-center rounded-full text-white", good ? "bg-ok" : "bg-danger")}>{good ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}</span>
                    {line ? (
                      <span>
                        <span lang="fr">{line.fr}</span> <span className="text-[14px] font-medium opacity-75">{line.tr}</span>
                      </span>
                    ) : good ? (
                      t.player.correctTitle
                    ) : (
                      t.player.wrongTitle
                    )}
                  </div>
                  {outcome.note && <p className="text-[14px] text-ink-2">{outcome.note}</p>}
                  {outcome.solution && (
                    <div className="text-[15px] text-ink">
                      {!good && <div className="text-[13px] font-semibold text-danger">{t.player.solution}</div>}
                      <Marked text={outcome.solution} marks={outcome.marks} />
                    </div>
                  )}
                  {outcome.meaning && (
                    <p className="text-[14px] text-ink-2">
                      <span className="font-medium">{t.player.meaning}</span> {outcome.meaning}
                    </p>
                  )}
                  {outcome.explain && (
                    <div className="mt-1 rounded-xl bg-raised/80 px-3 py-2 text-[14px] leading-snug text-ink-2 shadow-card">
                      <Bold text={resolveText(outcome.explain, locale)} />
                    </div>
                  )}
                  {!good && <p className="text-[12.5px] text-ink-3">{t.player.again}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {outcome ? (
          <button
            ref={button}
            type="button"
            onClick={onNext}
            className={cn(
              "h-13 shrink-0 rounded-2xl px-8 text-[16px] font-bold uppercase tracking-wide text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform active:translate-y-[2px] active:shadow-none sm:min-w-[180px]",
              outcome.skipped ? "bg-blob" : good ? "bg-ok" : "bg-danger",
            )}
          >
            {t.player.continue}
          </button>
        ) : (
          <button
            type="button"
            disabled={!ready}
            onClick={intro ? onNext : onCheck}
            className="h-13 shrink-0 rounded-2xl bg-blob px-8 text-[16px] font-bold uppercase tracking-wide text-white shadow-[0_4px_0_var(--blob-deep)] transition-[transform,opacity] active:translate-y-[2px] active:shadow-none disabled:bg-line disabled:text-ink-3 disabled:shadow-none sm:min-w-[180px]"
          >
            {intro ? t.player.continue : t.player.check}
          </button>
        )}
      </div>
    </motion.footer>
  );
}

/** Where "Next lesson" goes: the next lesson of the unit, or the first of the next unit. */
function nextLessonHref(unit: Unit, lesson: number): string | null {
  if (lesson < unit.lessons.length) return `/study/french/${unit.slug}/${lesson + 1}`;
  const nextUnit = UNITS.find((u) => u.n === unit.n + 1);
  return nextUnit ? `/study/french/${nextUnit.slug}/1` : null;
}

export { BlobSays };
