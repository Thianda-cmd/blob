"use client";

import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  ChartSpline,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  GraduationCap,
  Layers,
  Leaf,
  Lightbulb,
  Link2,
  ListChecks,
  Network,
  Paperclip,
  PenTool,
  Pin,
  Play,
  Presentation,
  Printer,
  RotateCw,
  Sigma,
  Table2,
  Undo2,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { LevelBars } from "@/learn/components/LevelBars";
import { MathView } from "@/learn/components/MathView";
import { TopicGlyph } from "@/learn/components/TopicGlyph";
import { cn } from "@/lib/utils";
import { PointList } from "./Points";
import { useReducedAfterMount, useTyping } from "./useTyping";

type Mode = "note" | "cards" | "quiz" | "summary";
const MODES: Mode[] = ["note", "cards", "quiz", "summary"];
const MODE_ICONS: Record<Mode, LucideIcon> = { note: FileText, cards: Layers, quiz: ListChecks, summary: BookOpenCheck };

/** Jonas's colour (his caret and avatar) and yours, from the app's peer colours. */
const PEER = "#2f6f6a";
const ME = "#6d3df5";
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The autoplay script: which view shows, what happens in it (`beat`) and for how long. `lead` frames
 * open the Learn menu on the way to the flashcards; they are skipped while someone holds a view.
 */
const FRAMES: { mode: Mode; beat: number; ms: number; lead?: boolean }[] = [
  { mode: "note", beat: 0, ms: 2800 },
  { mode: "note", beat: 1, ms: 2200 },
  { mode: "note", beat: 0, ms: 1500, lead: true },
  { mode: "cards", beat: 0, ms: 1400 },
  { mode: "cards", beat: 1, ms: 1400 },
  { mode: "cards", beat: 2, ms: 1500 },
  { mode: "cards", beat: 3, ms: 1900 },
  { mode: "quiz", beat: 0, ms: 1600 },
  { mode: "quiz", beat: 1, ms: 2600 },
  { mode: "summary", beat: 0, ms: 4800 },
];

/** With reduced motion nothing plays: each view shows its most telling moment (answer turned over, quiz answered). */
const STILL_BEAT: Record<Mode, number> = { note: 0, cards: 2, quiz: 1, summary: 0 };

/** The next frame: on through the script, or round the beats of the current view while it is held. */
function nextFrame(i: number, hold: boolean) {
  if (!hold) return (i + 1) % FRAMES.length;
  const mode = FRAMES[i].mode;
  const next = FRAMES[i + 1];
  if (next && next.mode === mode && !next.lead) return i + 1;
  return FRAMES.findIndex((f) => f.mode === mode);
}

/** A note on photosynthesis with a formula, a callout and a flashcard, and what the Learn menu makes of it. */
export function NoteShowcase({ className }: { className?: string }) {
  const t = useMessages(landingText).notes.demo;
  const scope = useId();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const still = useReducedAfterMount();
  const [i, setI] = useState(0);
  // Jonas starts typing the first time the note scrolls into view (derived-state latch during render).
  const [seen, setSeen] = useState(false);
  if (visible && !seen) setSeen(true);
  const [picked, setPicked] = useState(false);
  // Holds the current view while the pointer or the keyboard focus is on it, so it doesn't change under you.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hold = picked || hovered || focused;
  const frame = FRAMES[i];
  const beat = still ? STILL_BEAT[frame.mode] : frame.beat;

  useEffect(() => {
    if (!visible || still) return;
    const timer = setTimeout(() => setI((n) => nextFrame(n, hold)), FRAMES[i].ms);
    return () => clearTimeout(timer);
  }, [i, visible, still, hold]);

  const pick = (mode: Mode) => {
    setPicked(true);
    setI(FRAMES.findIndex((f) => f.mode === mode));
  };

  return (
    <div
      ref={ref}
      className={className}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
    >
      <div role="img" aria-label={t.label} className="relative overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
        {/* Keyed by view: a new bar, not a moved one, when the view changes. */}
        <TopBar key={frame.mode} mode={frame.mode} menu={!!frame.lead} />
        {/* Every view fits this fixed stage, so nothing below moves when the view changes. */}
        <div className="relative h-[448px] sm:h-[480px]">
          <AnimatePresence initial={false}>
            <motion.div
              key={frame.mode}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              {frame.mode === "note" ? (
                <NoteView beat={beat} active={seen} />
              ) : frame.mode === "cards" ? (
                <CardsView beat={beat} />
              ) : frame.mode === "quiz" ? (
                <QuizView beat={beat} />
              ) : (
                <SummaryView />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div role="group" aria-label={t.modesLabel} className="mx-auto mt-3 flex w-fit max-w-full rounded-xl border border-line bg-raised p-1 shadow-card">
        {MODES.map((m) => {
          const Icon = MODE_ICONS[m];
          const on = frame.mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => pick(m)}
              className={cn(
                "relative flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition-colors sm:px-3",
                on ? "text-white" : "text-ink-2 hover:text-ink",
              )}
            >
              {on && <motion.span layoutId={`${scope}-mode`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <Icon className="relative size-3.5 max-sm:hidden" />
              <span className="relative">{t.modes[m]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TopBar({ mode, menu }: { mode: Mode; menu: boolean }) {
  const t = useMessages(landingText).notes.demo;
  const Icon = MODE_ICONS[mode];
  return (
    <div className="relative z-10 flex h-11 items-center gap-2 border-b border-line px-3 text-[12.5px] sm:px-4">
      {mode === "note" ? (
        <>
          <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
            <span className="size-2 shrink-0 rounded-full bg-[var(--subject-moss)]" />
            <span className="truncate">{t.crumbs[0]}</span>
            <ChevronRight className="size-3 shrink-0 text-ink-3" />
            <Folder className="size-3.5 shrink-0 text-ink-3" />
            <span className="truncate">{t.crumbs[1]}</span>
          </span>
          <span className="ml-auto flex shrink-0 items-center">
            <Face name={t.me} color={ME} />
            <Face name={t.peer} color={PEER} here className="-ml-1" />
          </span>
          <span className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 font-medium transition-colors", menu ? "bg-hover text-ink" : "text-ink-2")}>
            <GraduationCap className="size-4" />
            {t.learn}
            <ChevronDown className="size-3 text-ink-3" />
          </span>
          <AnimatePresence>{menu && <LearnMenu />}</AnimatePresence>
        </>
      ) : (
        <>
          <ArrowLeft className="size-4 shrink-0 text-ink-3" />
          <span className="min-w-0 truncate font-medium text-ink">{t.title}</span>
          <span className="ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-blob-soft px-2.5 text-[12px] font-semibold text-blob-ink">
            <Icon className="size-3.5" />
            {t.modes[mode]}
          </span>
        </>
      )}
    </div>
  );
}

/** Someone's initial on their colour; `here`: a ring, they have the note open right now. */
function Face({ name, color, here, className }: { name: string; color: string; here?: boolean; className?: string }) {
  return (
    <span
      className={cn("grid size-[22px] place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-raised", className)}
      style={{ background: color, boxShadow: here ? `0 0 0 2px var(--raised), 0 0 0 3.5px ${color}` : undefined }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** The Learn menu of the note's top bar, open with Flashcards under the pointer. */
function LearnMenu() {
  const t = useMessages(landingText).notes.demo;
  const items = [
    { key: "cards", Icon: Layers, title: t.modes.cards, hint: t.hints.cards },
    { key: "quiz", Icon: ListChecks, title: t.modes.quiz, hint: t.hints.quiz },
    { key: "summary", Icon: BookOpenCheck, title: t.modes.summary, hint: t.hints.summary },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      style={{ originX: 1, originY: 0 }}
      className="absolute right-2 top-[42px] w-[248px] rounded-xl border border-line bg-raised p-1.5 shadow-pop"
    >
      <div className="px-2 pb-1.5 pt-1 text-[11.5px] leading-snug text-ink-3">{t.menuIntro}</div>
      {items.map(({ key, Icon, title, hint }, i) => (
        <div key={key} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", i === 0 && "bg-hover")}>
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border bg-surface", i === 0 ? "border-line-2 text-blob-ink" : "border-line text-ink-2")}>
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium leading-tight text-ink">{title}</span>
            <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-ink-3">{hint}</span>
          </span>
        </div>
      ))}
    </motion.div>
  );
}

function NoteView({ beat, active }: { beat: number; active: boolean }) {
  const t = useMessages(landingText).notes.demo;
  // Jonas writes a first line while you read (all at once with reduced motion).
  const { shown } = useTyping(active ? t.typed : "", 16);
  const callout = { "--c": "var(--callout-definition)" } as CSSProperties;
  return (
    <div className="h-full overflow-hidden px-4 pt-4 sm:px-6 sm:pt-5">
      <h4 className="font-display text-[22px] font-bold leading-tight tracking-[-0.025em]">{t.title}</h4>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[12.5px]">
        {t.tags.map((tag) => (
          <span key={tag} className="inline-flex h-6 items-center rounded-[7px] bg-hover/75 px-2 text-ink-2">
            #{tag}
          </span>
        ))}
        <span className="inline-flex h-6 items-center gap-1 rounded-[7px] bg-blob-soft/80 px-2 text-blob-ink">
          <GraduationCap className="size-3.5" />
          {t.topic}
        </span>
      </div>
      {/* A line of its own, so his name tag sits in the space under the tags rather than over words. */}
      <p className="mt-4 min-h-[1.625em] text-[14.5px] leading-relaxed">
        {shown}
        <span className="collab-caret" style={{ "--peer": PEER } as CSSProperties}>
          <span className="collab-caret-label">{t.peer}</span>
        </span>
      </p>
      <p className="text-[14.5px] leading-relaxed">
        {t.text}{" "}
        <span className="font-[550] underline decoration-blob/45 underline-offset-2">
          <FileText className="mr-0.5 inline size-[0.9em] -translate-y-px text-blob-ink/75" />
          {t.link}
        </span>
        {t.after}
      </p>
      <div className="mt-2 flex justify-center overflow-hidden rounded-xl py-1.5">
        <MathView src={t.formula} size="sm" animate={false} />
      </div>
      <div
        className="mt-2 flex gap-2 rounded-xl border bg-[color-mix(in_oklab,var(--c)_7%,var(--surface))] py-2 pl-2 pr-3 [border-color:color-mix(in_oklab,var(--c)_22%,var(--line))]"
        style={callout}
      >
        <span className="grid size-6 shrink-0 place-items-center text-[var(--c)]">
          <BookOpen className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase leading-6 tracking-[0.06em] text-[color-mix(in_oklab,var(--c)_82%,var(--ink))]">{t.callout.kind}</div>
          <p className="text-[14px] leading-snug">
            <strong className="font-semibold text-[color-mix(in_oklab,var(--c)_70%,var(--ink))]">{t.callout.term}</strong>
            {t.callout.text}
          </p>
        </div>
      </div>
      <FlashcardBlock flipped={beat === 1} />
      <LessonCard />
    </div>
  );
}

/** The lesson block: a topic of the learning center with your progress (from sm up, where there's room). */
function LessonCard() {
  const t = useMessages(landingText).notes.demo.lesson;
  const title = useMessages(landingText).notes.demo.topic;
  return (
    <div className="mt-4 flex gap-3 rounded-[14px] border border-line bg-raised p-2 shadow-card max-sm:hidden">
      <span className="grid w-[68px] shrink-0 place-items-center rounded-xl bg-blob-soft">
        <TopicGlyph topic={{ icon: "sun", glyph: "" }} size="sm" />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
          <Leaf className="size-3.5" />
          {t.subject}
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1.5 font-[550] text-ink-2">
            <LevelBars level={2} className="h-3" />
            {t.level}
          </span>
        </div>
        <div className="truncate font-display text-[16px] font-[650] leading-snug tracking-[-0.012em]">{title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-2">
          <span className="h-1.5 w-[72px] overflow-hidden rounded-full bg-line">
            <motion.span className="block h-full rounded-full bg-blob" initial={{ width: "20%" }} animate={{ width: "58%" }} transition={{ delay: 0.4, duration: 1.2, ease }} />
          </span>
          {t.mastery}
        </div>
      </div>
      <div className="flex shrink-0 items-end gap-1.5 self-end pb-0.5 text-[12.5px] font-medium">
        <span className="flex h-7 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-paper">
          <Play className="size-3 fill-current" />
          {t.start}
        </span>
        <span className="flex h-7 items-center rounded-lg border border-line px-2.5 text-ink-2 max-md:hidden">{t.practice}</span>
      </div>
    </div>
  );
}

/** The flashcard block as it sits in a note: a little stack of cards that turns over. */
function FlashcardBlock({ flipped }: { flipped: boolean }) {
  const t = useMessages(landingText).notes.demo.flashcard;
  return (
    <div className="mt-3 rounded-[14px] border border-line bg-raised px-3 pb-2.5 pt-2 shadow-[var(--shadow-card),0_5px_0_-2px_var(--surface),0_5px_0_-1px_var(--line)]">
      <div className="flex items-center gap-2.5 text-[12px] text-ink-3">
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-blob-soft pl-2 pr-2.5 font-semibold text-blob-ink">
          <Layers className="size-3.5" />
          {t.label}
        </span>
        <span className="flex gap-2">
          <span className={cn("transition-opacity duration-200", flipped ? "opacity-55" : "font-semibold text-ink-2")}>{t.front}</span>
          <span className={cn("transition-opacity duration-200", flipped ? "font-semibold text-ink-2" : "opacity-55")}>{t.back}</span>
        </span>
        <RotateCw className={cn("ml-auto size-3.5 transition-transform duration-500", flipped && "rotate-180")} />
      </div>
      <div className="mt-1.5 perspective-[1400px]">
        <motion.div className="grid transform-3d" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.6, ease }}>
          <div className="flex min-h-[50px] items-center justify-center rounded-[10px] px-2 text-center font-display text-[15.5px] font-semibold leading-snug backface-hidden [grid-area:1/1]">
            {t.q}
          </div>
          <div className="flex min-h-[50px] items-center rounded-[10px] bg-[color-mix(in_oklab,var(--blob-soft)_35%,var(--raised))] px-3 text-[14px] leading-snug backface-hidden rotate-y-180 [grid-area:1/1]">
            {t.a}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
      <span className="shrink-0 tabular-nums">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-blob" initial={false} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.5, ease }} />
      </div>
    </div>
  );
}

/** Studying: a card turns over, "Knew it", and it comes back in a few days; then the next card. */
function CardsView({ beat }: { beat: number }) {
  const t = useMessages(landingText).notes.demo.cards;
  const index = beat === 3 ? 1 : 0;
  const card = t.deck[index];
  const flipped = beat === 1 || beat === 2;
  const total = 8;
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-4 sm:px-8 sm:pb-5 sm:pt-5">
      <Progress label={t.progress(index + 1, total)} value={(index + (beat >= 2 ? 1 : 0)) / total} />
      <div className="relative mt-4 flex-1 perspective-[1400px]">
        <AnimatePresence initial={false}>
          <motion.div
            key={index}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease } }}
            exit={{ opacity: 0, x: 90, rotate: 5, transition: { duration: 0.4, ease } }}
          >
            <motion.div className="relative h-full transform-3d" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.6, ease }}>
              <StudyFace>
                <span className="w-fit rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{card.source}</span>
                <span className="my-auto text-balance px-2 pb-6 text-center font-display text-[20px] font-semibold leading-snug">{card.q}</span>
              </StudyFace>
              <StudyFace back>
                <span className="text-[12.5px] text-ink-3">{card.q}</span>
                <span className="my-auto text-balance px-2 pb-6 text-center text-[17px] font-medium leading-snug">{card.a}</span>
              </StudyFace>
            </motion.div>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {beat === 2 && (
            <motion.span
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-ok px-3 py-1 text-center text-[12.5px] font-semibold text-white shadow-pop"
            >
              {t.again(4)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-4 h-11">
        {flipped ? (
          <div className="grid h-full grid-cols-2 gap-2.5 text-[14px] font-semibold">
            <span className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-raised text-ink shadow-card">
              <X className="size-4 shrink-0 text-danger" />
              {t.didntKnow}
            </span>
            <span className={cn("flex items-center justify-center gap-1.5 rounded-xl bg-ok text-white shadow-card transition-transform duration-200", beat === 2 && "scale-[0.97]")}>
              <Check className="size-4 shrink-0" strokeWidth={2.6} />
              {t.knew}
            </span>
          </div>
        ) : (
          <span className="flex h-full items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-paper">
            <Undo2 className="size-4 -scale-x-100" />
            {t.flip}
          </span>
        )}
      </div>
    </div>
  );
}

function StudyFace({ back, children }: { back?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col rounded-2xl border border-line p-3.5 shadow-card backface-hidden",
        back ? "rotate-y-180 bg-[color-mix(in_oklab,var(--blob-soft)_35%,var(--raised))]" : "bg-raised",
      )}
    >
      {children}
    </div>
  );
}

/** A quiz question from the callout's definition, answered right. */
function QuizView({ beat }: { beat: number }) {
  const t = useMessages(landingText).notes.demo.quiz;
  const answered = beat === 1;
  return (
    <div className="flex h-full flex-col px-4 pt-4 sm:px-8 sm:pt-5">
      <Progress label={t.progress(3, 8)} value={(answered ? 3 : 2) / 8} />
      <p className="mt-6 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t.ask}</p>
      <p className="mt-1 text-balance font-display text-[20px] font-semibold leading-snug">{t.prompt}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {t.options.map((option, k) => {
          const right = answered && k === 1;
          return (
            <span
              key={option}
              className={cn(
                "flex h-12 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-[14px] font-medium transition-[background-color,border-color,color] duration-300",
                right ? "border-ok bg-ok/10 text-ok" : "border-line bg-raised text-ink",
                answered && !right && "opacity-60",
              )}
            >
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border text-[11px] font-semibold", right ? "border-ok bg-ok text-white" : "border-line-2 text-ink-3")}>
                {right ? <Check className="size-3" strokeWidth={3} /> : String.fromCharCode(65 + k)}
              </span>
              <span className="min-w-0 truncate">{option}</span>
            </span>
          );
        })}
      </div>
      <div className="mt-5 h-7">
        <AnimatePresence>
          {answered && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[15px] font-semibold text-ok"
            >
              <span className="grid size-6 place-items-center rounded-full bg-ok text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              {t.right}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The note boiled down: key sentences, terms and the formula. */
function SummaryView() {
  const d = useMessages(landingText).notes.demo;
  const t = d.summary;
  const kicker = "text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3";
  return (
    <div className="flex h-full flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-8 sm:pb-5 sm:pt-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="min-w-0 truncate font-display text-[18px] font-semibold tracking-[-0.015em]">{d.title}</h4>
        <span className="shrink-0 rounded-full bg-blob-soft px-2.5 py-0.5 text-[12px] font-semibold text-blob-ink">{t.shorter(64)}</span>
      </div>
      <p className={cn(kicker, "mt-4")}>{t.gist}</p>
      <ul className="mt-2 space-y-2">
        {t.points.map((point, k) => (
          <motion.li
            key={point}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + k * 0.3, duration: 0.4, ease }}
            className="flex gap-2.5 text-[14px] leading-snug"
          >
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-blob" />
            {point}
          </motion.li>
        ))}
      </ul>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className={kicker}>{t.terms}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.termList.map((term) => (
              <span key={term} className="rounded-lg border border-line bg-surface px-2 py-0.5 text-[13px] font-medium">
                {term}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <p className={kicker}>{t.formulas}</p>
          <div className="mt-1.5 overflow-hidden">
            <MathView src={d.formula} size="sm" animate={false} className="text-[15px]!" />
          </div>
        </div>
      </div>
      <div className="mt-auto flex gap-2 pt-4 text-[13px] font-medium">
        <span className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-paper">
          <FilePlus2 className="size-4" />
          {t.save}
        </span>
        <span className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-raised px-3.5 text-ink-2">
          <Printer className="size-4" />
          {t.print}
        </span>
      </div>
    </div>
  );
}

const BLOCKS: { key: keyof (typeof landingText)["en"]["notes"]["blocks"]["items"]; Icon: LucideIcon }[] = [
  { key: "formula", Icon: Sigma },
  { key: "table", Icon: Table2 },
  { key: "mindmap", Icon: Network },
  { key: "diagram", Icon: Workflow },
  { key: "sketch", Icon: PenTool },
  { key: "plot", Icon: ChartSpline },
  { key: "file", Icon: Paperclip },
  { key: "deck", Icon: Presentation },
  { key: "callout", Icon: Lightbulb },
  { key: "toggle", Icon: ChevronRight },
  { key: "flashcard", Icon: Layers },
  { key: "lesson", Icon: GraduationCap },
];

/** The blocks a note can hold (like the "/" menu), then what a note does beyond them. */
export function NoteFeatures({ className }: { className?: string }) {
  const t = useMessages(landingText).notes;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.5 });
  const reduce = useReducedMotion();
  const [lit, setLit] = useState(0);

  // The highlight walks through the blocks like a finger down the "/" menu.
  useEffect(() => {
    if (!visible || reduce) return;
    const timer = setInterval(() => setLit((n) => (n + 1) % BLOCKS.length), 1100);
    return () => clearInterval(timer);
  }, [visible, reduce]);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div ref={ref} className="rounded-2xl border border-line bg-raised p-4 shadow-card">
        <div className="flex gap-3">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface font-mono text-[14px] font-semibold text-blob-ink">
            /
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{t.blocks.title}</h3>
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{t.blocks.body}</p>
          </div>
        </div>
        <ul aria-hidden className="mt-3.5 flex flex-wrap gap-1.5">
          {BLOCKS.map(({ key, Icon }, i) => (
            <li
              key={key}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] transition-colors duration-300",
                i === lit ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line bg-surface text-ink-2",
              )}
            >
              <Icon className="size-3.5" />
              {t.blocks.items[key]}
            </li>
          ))}
        </ul>
      </div>
      <PointList
        className="sm:grid-cols-2 lg:grid-cols-1"
        points={[
          { key: "callouts", Icon: Pin, ...t.points.callouts },
          { key: "learn", Icon: GraduationCap, ...t.points.learn },
          { key: "links", Icon: Link2, ...t.points.links },
          { key: "lessons", Icon: BookOpen, ...t.points.lessons },
        ]}
      />
    </div>
  );
}
