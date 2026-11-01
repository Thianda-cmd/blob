"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Eye, LogOut, RotateCcw, Target, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { Ring } from "@/learn/components/Ring";
import type { StudySession } from "@/learn/session";
import { cn } from "@/lib/utils";
import { itemOf, makeRound, QUIZ_XP, type QuizQuestion } from "../quiz";
import type { AtlasView, PartsView, StepsView, TimelineView } from "../types";
import { EventIcon } from "./EventIcon";
import { Layout } from "./Layout";
import { PartsStage, type Mark } from "./PartsStage";
import { StepsStage } from "./StepsStage";

type Result = { q: QuizQuestion; correct: boolean };
type Answer = { correct: boolean; picked: string | number | null };

/**
 * A quiz round on one view: tap structures in the picture, name the marked one, order the
 * steps, date the milestones, and the textbook questions. Every answer is saved at once
 * (XP for the daily goal, mastery of the model), so leaving halfway loses nothing.
 */
export function Quiz({
  view,
  session,
  onExit,
  onLook,
}: {
  view: AtlasView;
  session: StudySession;
  onExit: () => void;
  /** Open an item in explore mode (after a mistake). */
  onLook: (item: string) => void;
}) {
  const t = useMessages(atlasText);
  const [round, setRound] = useState<QuizQuestion[]>(() => makeRound(view));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [xp, setXp] = useState(0);
  // Ordering questions: the items tapped in the right order so far, and the last wrong tap.
  const [sequence, setSequence] = useState<(string | number)[]>([]);
  const [slips, setSlips] = useState(0);
  const [shake, setShake] = useState<string | number | null>(null);
  const blob = useRef<BlobHandle>(null);
  const done = index >= round.length;
  const q = round[index];

  const settle = useCallback(
    (correct: boolean, picked: string | number | null) => {
      setAnswer({ correct, picked });
      setResults((r) => [...r, { q, correct }]);
      const gained = correct ? QUIZ_XP : 0;
      setXp((x) => x + gained);
      session.answer({ correct, xp: gained, level: 2 });
      if (correct) blob.current?.jump(0.6);
      else blob.current?.shake();
    },
    [q, session],
  );

  const next = useCallback(() => {
    setAnswer(null);
    setSequence([]);
    setSlips(0);
    setIndex((i) => i + 1);
  }, []);

  const restart = (focus?: { items: string[]; mc: number[] }) => {
    setRound(makeRound(view, focus ? { focus: focus.items, missedMc: focus.mc } : {}));
    setIndex(0);
    setAnswer(null);
    setResults([]);
    setXp(0);
    setSequence([]);
    setSlips(0);
  };

  // Enter goes on; 1–4 pick an option.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "Enter" && answer) {
        e.preventDefault();
        next();
        return;
      }
      if (!answer && /^[1-6]$/.test(e.key)) {
        const btn = document.querySelector<HTMLButtonElement>(`[data-quiz-option="${Number(e.key) - 1}"]`);
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, next]);

  if (done) {
    const right = results.filter((r) => r.correct).length;
    const missed = results.filter((r) => !r.correct);
    return (
      <Layout
        single={view.kind === "timeline"}
        stage={view.kind === "timeline" ? null : <QuizStage view={view} q={undefined} answer={null} />}
        panel={
          <ResultCard
            right={right}
            total={results.length}
            xp={xp}
            missed={missed}
            view={view}
            onAgain={() => restart()}
            onMistakes={missed.length ? () => restart({ items: missed.map((m) => itemOf(m.q)).filter((x): x is string => !!x), mc: missed.flatMap((m) => (m.q.kind === "mc" ? [m.q.index] : [])) }) : undefined}
            onExit={onExit}
            onLook={onLook}
          />
        }
      />
    );
  }

  const header = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-blob-ink">{t.question(index + 1, round.length)}</div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {round.map((_, i) => {
            const r = results[i];
            return <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", r ? (r.correct ? "bg-ok" : "bg-danger") : i === index ? "bg-blob/60" : "bg-line")} />;
          })}
        </div>
      </div>
      <Blob ref={blob} size={44} mood={answer ? (answer.correct ? "happy" : "worried") : "thinking"} className="-my-2 shrink-0" />
      <button type="button" onClick={onExit} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink" aria-label={t.quit} title={t.quit}>
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <Layout
      single={view.kind === "timeline"}
      panelFirst
      stage={
        view.kind === "timeline" ? null : (
          <QuizStage
            view={view}
            q={q}
            answer={answer}
            onPick={(id) => {
              if (answer || !q || (q.kind !== "find" && q.kind !== "clue")) return;
              settle(id === q.part, id);
            }}
          />
        )
      }
      panel={
        <section className="rounded-2xl border border-line bg-raised p-4 shadow-card sm:p-5">
          {header}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={index} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4">
              <Prompt
                view={view}
                q={q}
                answer={answer}
                sequence={sequence}
                shake={shake}
                onOption={(value, correct) => !answer && settle(correct, value)}
                onTapOrdered={(value, expected) => {
                  if (answer) return;
                  if (value === expected[sequence.length]) {
                    const seq = [...sequence, value];
                    setSequence(seq);
                    if (seq.length === expected.length) settle(slips === 0, null);
                  } else {
                    setSlips((s) => s + 1);
                    setShake(value);
                    setTimeout(() => setShake(null), 450);
                  }
                }}
              />
              {answer && <Feedback view={view} q={q} answer={answer} onNext={next} last={index === round.length - 1} />}
            </motion.div>
          </AnimatePresence>
        </section>
      }
    />
  );
}

/** The picture during the quiz: parts can be tapped, steps show the asked state. */
function QuizStage({ view, q, answer, onPick }: { view: AtlasView; q: QuizQuestion | undefined; answer: Answer | null; onPick?: (id: string) => void }) {
  if (view.kind === "parts") {
    const marks: Record<string, Mark> = {};
    if (answer && q && (q.kind === "find" || q.kind === "clue" || q.kind === "name")) {
      if (typeof answer.picked === "string" && answer.picked !== q.part && q.kind !== "name") marks[answer.picked] = "wrong";
      marks[q.part] = answer.correct ? "right" : q.kind === "name" ? "wrong" : "right";
    }
    const ask = q?.kind === "name" ? q.part : null;
    return <PartsStage view={view} selected={answer && q && "part" in q ? q.part : null} ask={answer ? null : ask} onPick={(id) => onPick?.(id)} labels={false} marks={marks} quiz />;
  }
  if (view.kind === "steps") {
    const step = q?.kind === "which" ? q.step : view.steps.length - 1;
    return <StepsStage view={view} step={step} onStep={() => {}} controls={false} />;
  }
  return null;
}

function Prompt({
  view,
  q,
  answer,
  sequence,
  shake,
  onOption,
  onTapOrdered,
}: {
  view: AtlasView;
  q: QuizQuestion;
  answer: Answer | null;
  sequence: (string | number)[];
  shake: string | number | null;
  onOption: (value: string | number, correct: boolean) => void;
  onTapOrdered: (value: string | number, expected: (string | number)[]) => void;
}) {
  const t = useMessages(atlasText);
  const tt = useText();
  const partName = (id: string) => (view as PartsView).parts.find((p) => p.id === id)?.info.name ?? id;
  const event = (id: string) => (view as TimelineView).events.find((e) => e.id === id)!;
  const yearOf = (id: string) => {
    const e = event(id);
    return e.when ? tt(e.when) : String(e.year);
  };

  switch (q.kind) {
    case "find":
      return (
        <div>
          <div className="text-[13px] font-medium text-ink-3">{t.tapOn}</div>
          <div className="mt-0.5 hyphens-auto font-display text-[24px] font-bold leading-tight tracking-[-0.015em] break-words">
            <Inline text={partName(q.part)} />
          </div>
        </div>
      );
    case "clue": {
      const part = (view as PartsView).parts.find((p) => p.id === q.part)!;
      return (
        <div>
          <div className="text-[13px] font-medium text-ink-3">{t.tapThat} …</div>
          <p className="mt-1 text-[17px] font-semibold leading-snug text-ink">
            … <Inline text={part.info.clue!} />
          </p>
        </div>
      );
    }
    case "name":
      return (
        <Options
          title={t.whatIsMarked}
          options={q.options.map((id) => ({ value: id, label: partName(id), correct: id === q.part }))}
          answer={answer}
          onOption={onOption}
        />
      );
    case "mc":
      return (
        <Options
          title={q.question.q}
          options={q.order.map((i) => ({ value: i, label: q.question.options[i], correct: i === q.question.correct }))}
          answer={answer}
          onOption={onOption}
        />
      );
    case "which": {
      const steps = (view as StepsView).steps;
      return <Options title={t.whichStep} options={q.options.map((s) => ({ value: s, label: steps[s].title, correct: s === q.step }))} answer={answer} onOption={onOption} />;
    }
    case "who": {
      const e = event(q.event);
      return (
        <Options
          title={t.whoDid}
          lead={<EventLead icon={e.icon} top={yearOf(q.event)} title={e.title} />}
          options={q.options.map((id) => ({ value: id, label: event(id).who, correct: id === q.event }))}
          answer={answer}
          onOption={onOption}
        />
      );
    }
    case "when": {
      const e = event(q.event);
      return (
        <Options
          title={t.whenWas}
          lead={<EventLead icon={e.icon} top={tt(e.who)} title={e.title} />}
          options={q.options.map((id) => ({ value: id, label: yearOf(id), correct: id === q.event }))}
          answer={answer}
          onOption={onOption}
          grid
        />
      );
    }
    case "order": {
      const steps = (view as StepsView).steps;
      const expected = [...q.items].sort((a, b) => a - b);
      return (
        <Ordered
          title={t.orderSteps}
          items={q.items.map((s) => ({ value: s, label: steps[s].title }))}
          expected={expected}
          sequence={sequence}
          shake={shake}
          done={!!answer}
          onTap={(v) => onTapOrdered(v, expected)}
        />
      );
    }
    case "chrono": {
      const expected = [...q.events].sort((a, b) => event(a).year - event(b).year);
      return (
        <Ordered
          title={t.oldestFirst}
          items={q.events.map((id) => ({ value: id, label: event(id).title, sub: answer || sequence.includes(id) ? `${yearOf(id)} · ${tt(event(id).who)}` : undefined }))}
          expected={expected}
          sequence={sequence}
          shake={shake}
          done={!!answer}
          onTap={(v) => onTapOrdered(v, expected)}
        />
      );
    }
  }
}

function EventLead({ icon, top, title }: { icon: TimelineView["events"][number]["icon"]; top: string; title: Text }) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blob-soft text-blob-ink">
        <EventIcon kind={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-ink-3">{top}</div>
        <div className="text-[15px] font-semibold leading-snug">
          <Inline text={title} />
        </div>
      </div>
    </div>
  );
}

function Options({
  title,
  lead,
  options,
  answer,
  onOption,
  grid,
}: {
  title: Text;
  lead?: ReactNode;
  options: { value: string | number; label: Text; correct: boolean }[];
  answer: Answer | null;
  onOption: (value: string | number, correct: boolean) => void;
  grid?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-[16.5px] font-semibold leading-snug text-ink">
        <Inline text={title} />
      </p>
      {lead}
      <div className={cn("grid gap-2", grid && "grid-cols-2")}>
        {options.map((o, i) => {
          const picked = answer?.picked === o.value;
          const state = answer ? (o.correct ? "right" : picked ? "wrong" : "idle") : "open";
          return (
            <button
              key={String(o.value)}
              type="button"
              data-quiz-option={i}
              disabled={!!answer}
              onClick={() => onOption(o.value, o.correct)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[14.5px] font-medium leading-snug transition-[background,border-color,color,transform] duration-150",
                state === "open" && "border-line bg-raised text-ink hover:border-blob/50 hover:bg-blob-soft/40 active:scale-[0.99]",
                state === "right" && "border-ok bg-ok/10 text-ink",
                state === "wrong" && "border-danger bg-danger/10 text-ink",
                state === "idle" && "border-line bg-raised text-ink-3",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md text-[11.5px] font-bold",
                  state === "right" ? "bg-ok text-white" : state === "wrong" ? "bg-danger text-white" : "bg-hover text-ink-3",
                )}
              >
                {state === "right" ? <Check className="size-3.5" strokeWidth={3} /> : state === "wrong" ? <X className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <Inline text={o.label} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Ordered({
  title,
  items,
  expected,
  sequence,
  shake,
  done,
  onTap,
}: {
  title: string;
  items: { value: string | number; label: Text; sub?: string }[];
  expected: (string | number)[];
  sequence: (string | number)[];
  shake: string | number | null;
  done: boolean;
  onTap: (value: string | number) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[16.5px] font-semibold leading-snug text-ink">{title}</p>
      <div className="grid gap-2">
        {items.map((o, i) => {
          const at = sequence.indexOf(o.value);
          const placed = at >= 0;
          const place = placed ? at + 1 : done ? expected.indexOf(o.value) + 1 : null;
          return (
            <motion.button
              key={String(o.value)}
              type="button"
              data-quiz-option={i}
              disabled={placed || done}
              onClick={() => onTap(o.value)}
              animate={shake === o.value ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[14.5px] font-medium leading-snug transition-[background,border-color,color] duration-150",
                placed ? "border-ok/60 bg-ok/10 text-ink" : shake === o.value ? "border-danger bg-danger/10" : "border-line bg-raised text-ink hover:border-blob/50 hover:bg-blob-soft/40",
              )}
            >
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-md text-[12px] font-bold tabular-nums", placed ? "bg-ok text-white" : place ? "bg-hover text-ink-2" : "border border-dashed border-line-2 text-transparent")}>
                {place ?? "·"}
              </span>
              <span className="min-w-0">
                <Inline text={o.label} />
                {o.sub && <span className="block text-[12px] font-normal text-ink-3">{o.sub}</span>}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Feedback({ view, q, answer, onNext, last }: { view: AtlasView; q: QuizQuestion; answer: Answer; onNext: () => void; last: boolean }) {
  const t = useMessages(atlasText);
  const tt = useText();
  let explain: Text | undefined;
  let wrongWas: string | undefined;
  let rightIs: string | undefined;
  if (view.kind === "parts" && "part" in q) {
    const part = view.parts.find((p) => p.id === q.part)!;
    explain = part.info.role;
    if (!answer.correct) {
      rightIs = tt(part.info.name);
      const picked = typeof answer.picked === "string" ? view.parts.find((p) => p.id === answer.picked) : undefined;
      if (picked && q.kind !== "name") wrongWas = tt(picked.info.name);
    }
  } else if (q.kind === "mc") {
    explain = q.question.why;
    if (!answer.correct) rightIs = tt(q.question.options[q.question.correct]);
  } else if (view.kind === "steps" && q.kind === "which") {
    explain = view.steps[q.step].body;
  } else if (view.kind === "timeline" && (q.kind === "who" || q.kind === "when")) {
    const e = view.events.find((x) => x.id === q.event)!;
    explain = tx2(`${e.when ? tt(e.when) : e.year} · ${tt(e.who)}: `, e.title);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-4 rounded-xl border px-3.5 py-3", answer.correct ? "border-ok/40 bg-ok/[0.07]" : "border-danger/40 bg-danger/[0.06]")}>
      <div className="flex items-center gap-2">
        <span className={cn("grid size-6 place-items-center rounded-full text-white", answer.correct ? "bg-ok" : "bg-danger")}>
          {answer.correct ? <Check className="size-3.5" strokeWidth={3.5} /> : <X className="size-3.5" strokeWidth={3.5} />}
        </span>
        <span className="text-[15px] font-semibold">{answer.correct ? t.right : t.wrong}</span>
        {answer.correct && <span className="ml-auto rounded-full bg-blob px-2 py-0.5 text-[11.5px] font-bold text-white">{t.xpPlus(QUIZ_XP)}</span>}
      </div>
      {(wrongWas || rightIs) && (
        <div className="mt-1.5 space-y-0.5 text-[13.5px]">
          {wrongWas && <div className="text-ink-2">{t.thatWas(wrongWas)}</div>}
          {rightIs && <div className="font-semibold text-ink">{t.rightAnswer(rightIs)}</div>}
        </div>
      )}
      {explain && (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
          <Inline text={explain} />
        </p>
      )}
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-[background,transform] hover:bg-blob-deep active:scale-[0.97]"
      >
        {last ? t.finish : t.continue} <ArrowRight className="size-4" />
      </button>
    </motion.div>
  );
}

/** A line built from plain text and a bilingual title. */
function tx2(prefix: string, text: Text): Text {
  return typeof text === "string" ? prefix + text : { en: prefix + text.en, de: prefix + text.de };
}

function ResultCard({
  right,
  total,
  xp,
  missed,
  view,
  onAgain,
  onMistakes,
  onExit,
  onLook,
}: {
  right: number;
  total: number;
  xp: number;
  missed: Result[];
  view: AtlasView;
  onAgain: () => void;
  onMistakes?: () => void;
  onExit: () => void;
  onLook: (item: string) => void;
}) {
  const t = useMessages(atlasText);
  const l = useMessages(learnText);
  const tt = useText();
  const pct = total ? Math.round((right / total) * 100) : 0;
  const great = pct >= 85;
  const looks = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: Text }[] = [];
    for (const m of missed) {
      const id = itemOf(m.q);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (view.kind === "parts") out.push({ id, label: view.parts.find((p) => p.id === id)!.info.name });
      else if (view.kind === "steps") out.push({ id, label: view.steps[Number(id)].title });
      else out.push({ id, label: view.events.find((e) => e.id === id)!.title });
    }
    return out;
  }, [missed, view]);

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-raised p-5 text-center shadow-card">
      <Blob size={84} mood={great ? "proud" : pct >= 50 ? "happy" : "thinking"} className="mx-auto" />
      <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.015em]">{great ? t.roundGreat : t.roundDone}</h2>
      <div className="mt-4 flex items-center justify-center gap-6">
        <Ring value={pct / 100} size={76} stroke={7} color={great ? "var(--ok)" : "var(--blob)"}>
          <span className="text-[17px] font-bold tabular-nums">{l.pct(pct)}</span>
        </Ring>
        <div className="space-y-1.5 text-left text-[13.5px]">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-ink-3" />
            <span className="font-semibold tabular-nums">{t.score(right, total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid size-4 place-items-center rounded-full bg-blob text-[8px] font-bold text-white">XP</span>
            <span>
              <span className="font-semibold tabular-nums">{xp}</span> {t.xpEarned}
            </span>
          </div>
        </div>
      </div>
      {looks.length > 0 && (
        <div className="mt-5 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.lookAgain}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {looks.map((l) => (
              <button key={l.id} type="button" onClick={() => onLook(l.id)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-blob/50 hover:text-ink">
                <Eye className="size-3.5" /> {tt(l.label)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {onMistakes && (
          <button type="button" onClick={onMistakes} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-[background,transform] hover:bg-blob-deep active:scale-[0.97]">
            <Target className="size-4" /> {t.practiseMistakes}
          </button>
        )}
        <button
          type="button"
          onClick={onAgain}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-[background,transform] active:scale-[0.97]",
            onMistakes ? "border border-line bg-raised text-ink hover:bg-hover" : "bg-blob text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-blob-deep",
          )}
        >
          <RotateCcw className="size-4" /> {t.again}
        </button>
        <button type="button" onClick={onExit} className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink", onMistakes && "sm:col-span-2")}>
          {t.backToExplore}
        </button>
      </div>
    </motion.section>
  );
}
