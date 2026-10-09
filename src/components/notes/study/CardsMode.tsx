"use client";

import { motion, useMotionValue, useTransform } from "motion/react";
import { ArrowLeftRight, Check, Dumbbell, Layers, ListChecks, Pencil, RotateCcw, Search, Undo2, X } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { useNow } from "@/components/tasks/useNow";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { studyText, type StudyText } from "@/i18n/messages/study";
import { Confetti } from "@/learn/components/Confetti";
import { CountUp, StudyButton } from "@/learn/components/StudyChrome";
import { Tutor } from "@/learn/components/Tutor";
import { plain, type Line } from "@/notes/doc";
import type { Card } from "@/notes/study/cards";
import { addDays, answer, cardState, setSuspended, today, type CardState, type Review } from "@/notes/study/srs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { RichLines } from "./RichLine";
import type { CardEdits } from "./useCardEdits";
import { EmptyNote } from "./EmptyNote";

/** New cards per round (the rest wait for the next one). */
const NEW_PER_ROUND = 20;

type Phase = "overview" | "session" | "done";
type Result = { knewFirst: boolean; misses: number; wasNew: boolean };
type Session = { queue: Card[]; total: number; practice: boolean; reverse: boolean; results: Map<string, Result>; turn: number };

export function CardsMode({
  pageId,
  title,
  cards,
  generated,
  edits,
  empty,
  reviews: initialReviews,
  userId,
  onProgress,
  onQuiz,
}: {
  pageId: string;
  title: string;
  cards: Card[];
  generated: Card[];
  edits: CardEdits;
  empty: boolean;
  reviews: Review[];
  userId: string;
  onProgress: (p: number | null) => void;
  onQuiz: () => void;
}) {
  const t = useMessages(studyText);
  const locale = useLocale();
  const now = useNow();
  const day = now ? today(new Date(now)) : null;
  const [reviews, setReviews] = useState(() => new Map(initialReviews.map((r) => [r.card_id, r])));
  const [phase, setPhase] = useState<Phase>("overview");
  const [session, setSession] = useState<Session | null>(null);
  const [reverse, setReverse] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const states = useMemo(() => new Map(cards.map((c) => [c.id, day ? cardState(reviews.get(c.id), day) : ("new" as CardState)])), [cards, reviews, day]);
  const count = (s: CardState) => cards.filter((c) => states.get(c.id) === s).length;
  const dueCards = cards.filter((c) => states.get(c.id) === "due").sort((a, b) => (reviews.get(a.id)?.box ?? 0) - (reviews.get(b.id)?.box ?? 0));
  const newCards = cards.filter((c) => states.get(c.id) === "new");
  const roundSize = dueCards.length + Math.min(NEW_PER_ROUND, newCards.length);
  const nextDue = useMemo(() => {
    const later = [...reviews.values()].filter((r) => r.reviews > 0 && day && r.due_on > day && r.due_on < "9999" && cards.some((c) => c.id === r.card_id));
    return later.map((r) => r.due_on).sort()[0] ?? null;
  }, [reviews, day, cards]);

  async function save(row: Review) {
    setReviews((m) => new Map(m).set(row.card_id, row));
    const { error } = await createClient()
      .from("card_reviews")
      .upsert({ ...row, user_id: userId, page_id: pageId }, { onConflict: "user_id,page_id,card_id" });
    if (error) setSaveError(true);
  }

  function start(practice: boolean, only?: Card[]) {
    const queue = only ?? (practice ? cards.filter((c) => states.get(c.id) !== "off") : [...dueCards, ...newCards.slice(0, NEW_PER_ROUND)]);
    if (!queue.length) return;
    setSession({ queue, total: queue.length, practice, reverse, results: new Map(), turn: 0 });
    setPhase("session");
    onProgress(0);
  }

  function finish() {
    setPhase("done");
    onProgress(null);
  }

  function stop() {
    setSession(null);
    setPhase("overview");
    onProgress(null);
  }

  function respond(knew: boolean) {
    if (!session || !day) return;
    const card = session.queue[0];
    const results = new Map(session.results);
    const first = !results.has(card.id);
    const prev = results.get(card.id);
    results.set(card.id, {
      knewFirst: first ? knew : prev!.knewFirst,
      misses: (prev?.misses ?? 0) + (knew ? 0 : 1),
      wasNew: first ? states.get(card.id) === "new" : prev!.wasNew,
    });
    if (!session.practice) void save(answer(reviews.get(card.id), card.id, knew, day));
    // A card you didn't know comes back a few cards later.
    const rest = session.queue.slice(1);
    if (!knew) rest.splice(Math.min(rest.length, 3), 0, card);
    const pending = rest.filter((c) => results.has(c.id)).length;
    onProgress(Math.min(1, (results.size - pending) / session.total));
    setSession({ ...session, queue: rest, results, turn: session.turn + 1 });
    if (!rest.length) finish();
  }

  if (empty) return <EmptyNote pageId={pageId} />;

  if (phase === "session" && session && session.queue.length) {
    return <Round key={session.total} session={session} title={title} onAnswer={respond} onStop={stop} />;
  }

  if (phase === "done" && session) {
    const results = [...session.results.values()];
    const knew = results.filter((r) => r.knewFirst).length;
    const missed = session.queue.length ? [] : [...session.results.entries()].filter(([, r]) => r.misses > 0).map(([id]) => cards.find((c) => c.id === id)).filter((c): c is Card => Boolean(c));
    const tomorrow = day ? addDays(day, 1) : "";
    const dueTomorrow = [...reviews.values()].filter((r) => r.reviews > 0 && r.due_on === tomorrow && cards.some((c) => c.id === r.card_id)).length;
    return (
      <Done
        title={t.cards.endTitle[results.length % t.cards.endTitle.length]}
        text={t.cards.endText(results.length)}
        note={session.practice ? t.cards.endPractice : dueTomorrow ? t.cards.dueTomorrow(dueTomorrow) : null}
        stats={[
          { label: t.cards.knewStat, value: knew, tone: "ok" },
          { label: t.cards.againStat, value: missed.length, tone: "ink" },
          { label: t.cards.newStat, value: results.filter((r) => r.wasNew).length, tone: "blob" },
        ]}
        happy={knew >= results.length / 2}
        say={results.length >= 10 ? t.cards.blobTen : t.cards.blobDone}
      >
        {missed.length > 0 && (
          <StudyButton onClick={() => start(true, missed)} variant="blob">
            <Dumbbell className="size-4" /> {t.cards.repeatWrong}
          </StudyButton>
        )}
        <StudyButton onClick={onQuiz} variant={missed.length ? "ink" : "blob"}>
          <ListChecks className="size-4" /> {t.cards.takeQuiz}
        </StudyButton>
        <StudyButton onClick={stop} variant="ghost">
          <Layers className="size-4" /> {t.cards.preview}
        </StudyButton>
      </Done>
    );
  }

  const stats: { key: CardState; label: string; n: number; tone: string }[] = [
    { key: "due", label: t.cards.stats.due, n: count("due"), tone: "text-blob" },
    { key: "new", label: t.cards.stats.new, n: count("new"), tone: "text-ink" },
    { key: "later", label: t.cards.stats.later, n: count("later"), tone: "text-ok" },
    { key: "off", label: t.cards.stats.off, n: count("off"), tone: "text-ink-3" },
  ];

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.cards.title}</div>
          <h1 className="mt-1 text-balance font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{title}</h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-ink-2">{t.cards.intro}</p>
        </div>
        <div className="hidden sm:block">
          <Blob size={112} mood={count("due") ? "happy" : "idle"} accessory="glasses" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-2.5">
        {stats.map((s) => (
          <div key={s.key} className="rounded-2xl border border-line bg-raised px-3 py-2.5 shadow-card sm:px-4 sm:py-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3 sm:text-[11.5px]">{s.label}</div>
            <div className={cn("mt-0.5 font-display text-[22px] font-bold tabular-nums sm:text-[28px]", s.n ? s.tone : "text-ink-3/60")}>{day ? s.n : "–"}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {roundSize > 0 ? (
            <StudyButton onClick={() => start(false)} variant="blob" className="w-full sm:w-auto">
              <Layers className="size-4" /> {t.cards.start(roundSize)}
            </StudyButton>
          ) : (
            <div>
              <div className="font-display text-[18px] font-semibold text-ink">{count("off") === cards.length ? t.cards.nothingDue : t.cards.allDone}</div>
              {nextDue && <p className="text-[13.5px] text-ink-2">{t.cards.nextDue(whenLabel(nextDue, day, locale))}</p>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2 text-[13.5px] text-ink-2 hover:bg-hover" title={t.cards.reverseHint}>
            <Switch on={reverse} onChange={setReverse} label={t.cards.reverse} />
            <ArrowLeftRight className="size-4 text-ink-3" />
            {t.cards.reverse}
          </label>
          <StudyButton onClick={() => start(true)} variant={roundSize > 0 ? "ghost" : "ink"}>
            <Dumbbell className="size-4" /> {t.cards.practiceAll}
          </StudyButton>
        </div>
      </div>
      {roundSize === 0 && <p className="mt-2 px-1 text-[12.5px] text-ink-3">{t.cards.practiceHint}</p>}
      {saveError && (
        <p className="mt-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger" role="alert">
          {t.cards.saveFailed}
        </p>
      )}

      <Preview cards={cards} generated={generated} states={states} reviews={reviews} day={day} edits={edits} onToggle={(card, off) => day && void save(setSuspended(reviews.get(card.id), card.id, off, day))} />
    </div>
  );
}

function whenLabel(due: string, day: string | null, locale: "de" | "en") {
  const t = studyText[locale];
  if (day && due === addDays(day, 1)) return t.cards.state.in(1).toLowerCase();
  const [y, m, d] = due.split("-").map(Number);
  return locale === "de" ? `am ${format(new Date(y, m - 1, d), "EEEE, d. MMMM", { locale: dateLocale(locale) })}` : `on ${format(new Date(y, m - 1, d), "EEEE, d MMMM", { locale: dateLocale(locale) })}`;
}

/** Where a card comes from, as a chip ("Definition", "Datum", "Vokabel", "Lücke"…). */
const sourceLabel = (card: Card, t: StudyText) => (card.group === "date" ? t.sources.date : card.group === "vocab" ? t.sources.vocab : t.sources[card.source]);

/** One round: a card at a time, flip, then "knew it" or not (buttons, keys 1 and 2, or a swipe). */
function Round({ session, title, onAnswer, onStop }: { session: Session; title: string; onAnswer: (knew: boolean) => void; onStop: () => void }) {
  const t = useMessages(studyText);
  const card = session.queue[0];
  const [flipped, setFlipped] = useState(false);
  const [turn, setTurn] = useState(session.turn);
  // Every answer brings the next card face up (also when the same card comes straight back).
  if (turn !== session.turn) {
    setTurn(session.turn);
    setFlipped(false);
  }
  const reversed = session.reverse && card.source !== "cloze";
  const answered = session.results.size;
  const seenBefore = session.results.has(card.id);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((document.activeElement as HTMLElement | null)?.closest("input, textarea")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onStop();
    } else if (!flipped && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      setFlipped(true);
    } else if (flipped && (e.key === "1" || e.key === "ArrowLeft")) {
      e.preventDefault();
      onAnswer(false);
    } else if (flipped && (e.key === "2" || e.key === "ArrowRight" || e.key === " ")) {
      e.preventDefault();
      onAnswer(true);
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
      <div className="mb-3 flex items-center justify-between gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        <span className="tabular-nums">{t.cards.progress(Math.min(answered + (seenBefore ? 0 : 1), session.total), session.total)}</span>
        <span className="flex min-w-0 items-center gap-2 normal-case tracking-normal">
          {seenBefore && <span className="rounded-full bg-hover px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{t.cards.again}</span>}
          <span className="truncate font-medium" title={title}>
            {card.context}
          </span>
        </span>
      </div>

      <FlipCard key={session.turn} card={card} flipped={flipped} reversed={reversed} onFlip={() => setFlipped(true)} onAnswer={onAnswer} />

      <div className="mt-5 min-h-[92px]">
        {flipped ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onAnswer(false)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-raised text-[15px] font-semibold text-ink shadow-card transition-[transform,border-color] hover:border-danger/40 active:scale-[0.98]"
            >
              <X className="size-4.5 text-danger" /> {t.cards.didntKnow}
              <kbd className="ml-1 hidden rounded-md border border-line px-1.5 text-[11px] font-medium text-ink-3 pointer-fine:inline">1</kbd>
            </button>
            <button
              onClick={() => onAnswer(true)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-ok text-[15px] font-semibold text-white shadow-card transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              <Check className="size-4.5" strokeWidth={2.6} /> {t.cards.knew}
              <kbd className="ml-1 hidden rounded-md border border-white/40 px-1.5 text-[11px] font-medium text-white/85 pointer-fine:inline">2</kbd>
            </button>
          </motion.div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-semibold text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition-transform hover:bg-ink/88 active:scale-[0.99]"
          >
            <Undo2 className="size-4.5 -scale-x-100" /> {t.cards.flip}
            <kbd className="ml-1 hidden rounded-md border border-paper/30 px-1.5 text-[11px] font-medium text-paper/80 pointer-fine:inline">{t.cards.flipHint}</kbd>
          </button>
        )}
        <p className="mt-3 text-center text-[12px] text-ink-3">
          <span className="hidden pointer-fine:inline">{t.cards.keys}</span>
          <span className="pointer-fine:hidden">{flipped ? t.cards.swipe : ""}</span>
        </p>
      </div>
    </div>
  );
}

/** The card itself: turns over in 3D; after turning, swipe right (knew it) or left. */
function FlipCard({ card, flipped, reversed, onFlip, onAnswer }: { card: Card; flipped: boolean; reversed: boolean; onFlip: () => void; onAnswer: (knew: boolean) => void }) {
  const t = useMessages(studyText);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-8, 8]);
  const good = useTransform(x, [20, 140], [0, 1]);
  const bad = useTransform(x, [-140, -20], [1, 0]);
  const front = reversed ? card.back : card.front;
  const back = reversed ? card.front : card.back;
  const prompt = card.prompt === "@when" ? t.when : card.prompt ? `${card.prompt}?` : card.source === "cloze" ? t.gap : null;

  return (
    <motion.div
      style={{ x, rotate }}
      drag={flipped ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 700) onAnswer(true);
        else if (info.offset.x < -110 || info.velocity.x < -700) onAnswer(false);
      }}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="relative [perspective:1600px]"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="grid [transform-style:preserve-3d]"
        onClick={() => !flipped && onFlip()}
      >
        {/* Front */}
        <Face className={cn("cursor-pointer", flipped && "pointer-events-none")}>
          <FaceHead card={card} prompt={reversed ? null : prompt} />
          <div className="flex flex-1 items-center justify-center py-6">
            <Side lines={front} big list={reversed && front.length > 1} />
          </div>
        </Face>
        {/* Back */}
        <Face back className={cn(!flipped && "pointer-events-none")}>
          <FaceHead card={card} prompt={null} />
          {card.source !== "cloze" && (
            <div className="mx-auto mt-1 max-w-[560px] text-center text-[13.5px] leading-snug text-ink-3">
              <RichLines lines={front.slice(0, 2)} />
            </div>
          )}
          <div className="mx-auto my-3 h-px w-16 bg-line-2" />
          <div className="flex flex-1 items-center justify-center pb-4">
            <Side lines={back} big={false} list={back.length > 1} />
          </div>
        </Face>
      </motion.div>
      {/* Swipe hints */}
      <motion.span style={{ opacity: good }} className="pointer-events-none absolute right-4 top-4 rounded-full bg-ok px-3 py-1 text-[13px] font-semibold text-white shadow-pop">
        {t.cards.knew}
      </motion.span>
      <motion.span style={{ opacity: bad }} className="pointer-events-none absolute left-4 top-4 rounded-full bg-danger px-3 py-1 text-[13px] font-semibold text-white shadow-pop">
        {t.cards.didntKnow}
      </motion.span>
    </motion.div>
  );
}

function Face({ back, className, children }: { back?: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex min-h-[min(56dvh,380px)] flex-col rounded-3xl border border-line bg-raised p-5 shadow-[0_1px_1px_rgb(28_27_24/0.04),0_14px_34px_-12px_rgb(28_27_24/0.22)] [backface-visibility:hidden] [grid-area:1/1] sm:p-7",
        back && "[transform:rotateY(180deg)]",
        className,
      )}
    >
      <span className="bg-dots pointer-events-none absolute inset-0 rounded-3xl opacity-25" />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function FaceHead({ card, prompt }: { card: Card; prompt: string | null }) {
  const t = useMessages(studyText);
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{sourceLabel(card, t)}</span>
      {prompt && <span className="rounded-full bg-blob-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-blob-ink">{prompt}</span>}
    </div>
  );
}

/** One side's text: big and centred when short, calmer when long. */
function Side({ lines, big, list }: { lines: Line[]; big: boolean; list: boolean }) {
  const length = lines.map(plain).join(" ").length;
  const size = big
    ? length < 40
      ? "font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] sm:text-[32px]"
      : length < 140
        ? "text-[19px] font-medium leading-snug sm:text-[22px]"
        : "text-[16px] leading-relaxed sm:text-[17px]"
    : length < 60
      ? "font-display text-[22px] font-semibold leading-snug sm:text-[26px]"
      : length < 200
        ? "text-[17px] leading-relaxed sm:text-[18px]"
        : "text-[15px] leading-relaxed sm:text-[16px]";
  return (
    <div className={cn("w-full max-w-[600px] text-balance text-ink", list ? "text-left" : "text-center", size)}>
      <RichLines lines={lines} list={list} />
    </div>
  );
}

/** The end of a round. */
function Done({
  title,
  text,
  note,
  stats,
  happy,
  say,
  children,
}: {
  title: string;
  text: string;
  note: string | null;
  stats: { label: string; value: number; tone: "ok" | "ink" | "blob" }[];
  happy: boolean;
  say: string;
  children: ReactNode;
}) {
  const blob = useRef<BlobHandle>(null);
  useEffect(() => {
    const timer = setTimeout(() => (happy ? blob.current?.celebrate() : blob.current?.wave()), 350);
    return () => clearTimeout(timer);
  }, [happy]);
  return (
    <div className="mx-auto grid w-full max-w-[880px] items-center gap-6 px-5 py-8 md:min-h-[calc(100dvh-3.5rem-1px)] md:grid-cols-[240px_minmax(0,1fr)] md:py-12">
      <div className="relative mx-auto grid place-items-center overflow-x-clip">
        {happy && <Confetti seed={5} spread={220} />}
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
          <Tutor say={say} mood={happy ? "excited" : "happy"} accessory="cap" size={150} blobRef={blob} side="left" />
        </motion.div>
      </div>
      <div className="space-y-5">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">
            {title}
          </motion.h1>
          <p className="mt-1.5 text-[15px] text-ink-2">{text}</p>
          {note && <p className="mt-1 text-[13.5px] text-ink-3">{note}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 380, damping: 26 }}
              className="rounded-2xl border border-line bg-raised px-3 py-2.5 shadow-card sm:px-4 sm:py-3"
            >
              <div className="text-[10.5px] font-semibold uppercase leading-snug tracking-[0.08em] text-ink-3 sm:text-[11.5px]">{s.label}</div>
              <div className={cn("mt-0.5 font-display text-[24px] font-bold tabular-nums sm:text-[28px]", s.tone === "ok" ? "text-ok" : s.tone === "blob" ? "text-blob" : "text-ink")}>
                <CountUp value={s.value} from={0} delay={0.3 + i * 0.08} />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">{children}</div>
      </div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onChange(!on);
      }}
      className={cn(
        // The switch is small to look at; a finger gets a 40 px tall area around it.
        "relative h-5 w-9 shrink-0 rounded-full transition-colors before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']",
        on ? "bg-blob" : "bg-line-2",
      )}
    >
      <motion.span className="absolute top-0.5 size-4 rounded-full bg-white shadow-card" animate={{ left: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 34 }} />
    </button>
  );
}

/** Every card of the note: switch it off, or put it in your own words. */
function Preview({
  cards,
  generated,
  states,
  reviews,
  day,
  edits,
  onToggle,
}: {
  cards: Card[];
  generated: Card[];
  states: Map<string, CardState>;
  reviews: Map<string, Review>;
  day: string | null;
  edits: CardEdits;
  onToggle: (card: Card, off: boolean) => void;
}) {
  const t = useMessages(studyText);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shown = q ? cards.filter((c) => [...c.front, ...c.back].map(plain).join(" ").toLowerCase().includes(q)) : cards;
  const groups: { context: string; cards: Card[] }[] = [];
  for (const c of shown) {
    const last = groups[groups.length - 1];
    if (last && last.context === c.context) last.cards.push(c);
    else groups.push({ context: c.context, cards: [c] });
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">
          {t.cards.preview} <span className="font-medium text-ink-3">· {cards.length}</span>
        </h2>
        <label className="relative w-full sm:w-[240px]">
          <span className="sr-only">{t.cards.search}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.cards.search}
            className="h-9 w-full rounded-xl border border-line bg-raised pl-9 pr-3 text-[13.5px] outline-none placeholder:text-ink-3/80 focus:border-blob"
          />
        </label>
      </div>
      {!shown.length && <p className="rounded-xl border border-dashed border-line-2 px-4 py-8 text-center text-[13px] text-ink-3">{t.cards.noMatch}</p>}
      <div className="space-y-5">
        {groups.map((g, gi) => (
          <div key={`${g.context}-${gi}`}>
            {g.context && <h3 className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{g.context}</h3>}
            <ul className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
              {g.cards.map((c, i) => (
                <PreviewRow
                  key={c.id}
                  card={c}
                  original={generated.find((o) => o.id === c.id) ?? c}
                  first={i === 0}
                  state={states.get(c.id) ?? "new"}
                  review={reviews.get(c.id)}
                  day={day}
                  edited={edits.has(c.id)}
                  editing={editing === c.id}
                  onEdit={() => setEditing(c.id)}
                  onDone={() => setEditing(null)}
                  edits={edits}
                  onToggle={onToggle}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewRow({
  card,
  original,
  first,
  state,
  review,
  day,
  edited,
  editing,
  onEdit,
  onDone,
  edits,
  onToggle,
}: {
  card: Card;
  original: Card;
  first: boolean;
  state: CardState;
  review?: Review;
  day: string | null;
  edited: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  edits: CardEdits;
  onToggle: (card: Card, off: boolean) => void;
}) {
  const t = useMessages(studyText);
  const off = state === "off";
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const days = review && day && state === "later" ? Math.round((Date.parse(review.due_on) - Date.parse(day)) / 86_400_000) : 0;
  const chip =
    state === "off" ? t.cards.state.off : state === "due" ? t.cards.state.due : state === "new" ? t.cards.state.new : t.cards.state.in(Math.max(1, days));

  if (editing) {
    return (
      <li className={cn("space-y-2 bg-surface px-4 py-3.5", !first && "border-t border-line")}>
        <div className="text-[12px] font-semibold text-ink-2">{t.cards.editing}</div>
        <label className="block">
          <span className="text-[11.5px] font-medium text-ink-3">{t.cards.front}</span>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className="mt-0.5 w-full resize-y rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[14px] outline-none focus:border-blob" />
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-ink-3">{t.cards.back}</span>
          <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} className="mt-0.5 w-full resize-y rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[14px] outline-none focus:border-blob" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              edits.set(card.id, { front, back });
              onDone();
            }}
            className="h-8 rounded-lg bg-ink px-3 text-[13px] font-medium text-paper hover:bg-ink/88"
          >
            {t.cards.save}
          </button>
          <button onClick={onDone} className="h-8 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover">
            {t.cards.cancel}
          </button>
          {edited && (
            <button
              onClick={() => {
                edits.reset(card.id);
                onDone();
              }}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> {t.cards.reset}
            </button>
          )}
          <span className="w-full text-[11.5px] text-ink-3">{t.cards.editedHint}</span>
        </div>
      </li>
    );
  }

  return (
    <li className={cn("group flex items-start gap-3 px-3 py-3 sm:px-4", !first && "border-t border-line", off && "bg-surface/60")}>
      <div className={cn("min-w-0 flex-1 transition-opacity", off && "opacity-45")}>
        <div className="text-[14px] font-medium leading-snug text-ink">
          {card.prompt && <span className="mr-1.5 text-[12px] font-semibold text-blob-ink">{card.prompt === "@when" ? t.when : `${card.prompt}?`}</span>}
          <RichLines lines={card.front.slice(-1)} />
        </div>
        <div className="mt-1 line-clamp-3 text-[13px] leading-snug text-ink-2">
          {card.source === "cloze" ? <span className="font-medium text-blob-ink">{card.answer}</span> : <RichLines lines={card.back} />}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-hover px-1.5 py-px font-medium text-ink-3">{sourceLabel(original, t)}</span>
          <span className={cn("rounded-full px-1.5 py-px font-medium", state === "due" ? "bg-blob/15 text-blob-ink" : state === "later" ? "bg-ok/12 text-ok" : "bg-hover text-ink-3")}>{chip}</span>
          {edited && <span className="rounded-full bg-hover px-1.5 py-px font-medium text-ink-3">{t.cards.edited}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => {
            setFront(card.front.map(plain).join("\n"));
            setBack(card.source === "cloze" ? (card.answer ?? "") : card.back.map(plain).join("\n"));
            onEdit();
          }}
          className="grid size-8 place-items-center rounded-lg text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={t.cards.edit}
          title={t.cards.edit}
        >
          <Pencil className="size-3.5" />
        </button>
        <span className="grid h-8 place-items-center px-1">
          <Switch on={!off} onChange={(v) => onToggle(card, !v)} label={off ? t.cards.on : t.cards.off} />
        </span>
      </div>
    </li>
  );
}

