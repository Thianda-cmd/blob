"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeQuestionMark, BarChart3, ChevronRight, Copy, GripVertical, Keyboard, LayoutGrid, ListOrdered, Play, Plus, Settings2, SlidersHorizontal, ToggleLeft, Trash2, TriangleAlert, Vote, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { blob } from "@/components/blob/bus";
import { SaveIndicator } from "@/components/page/SaveIndicator";
import { useAutosave } from "@/components/page/useAutosave";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Input";
import { Popover } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { quizText, type QuizText } from "@/i18n/messages/quiz";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { LIMITS, QUESTION_TYPES, TIME_OPTIONS, convertQuestion, issuesOf, newId, newQuestion, type PointsMode, type Question, type QuestionType, type Quiz, type QuizSettings } from "@/quiz/model";
import { api } from "../api";
import { Shape, styleAt } from "../Shape";
import { QuestionEditor } from "./QuestionEditor";
import { SortableList, type Handle } from "./Sortable";

type T = QuizText;

export type GameSummary = { id: string; pin: string; phase: string; createdAt: string; endedAt: string | null; questions: number; players: number };

export const TYPE_ICONS: Record<QuestionType, typeof LayoutGrid> = { quiz: LayoutGrid, truefalse: ToggleLeft, type: Keyboard, poll: Vote, puzzle: ListOrdered, slider: SlidersHorizontal };

type Saved = Pick<Quiz, "title" | "description" | "questions" | "settings" | "subject_id">;

/** Making a quiz (/quiz/<id>): the questions on the left, the one you work on in the middle, its settings on the right. Saved as you go. */
export function QuizEditor({ initial, games }: { initial: Quiz; games: GameSummary[] }) {
  const t = useMessages(quizText);
  const locale = useLocale();
  const router = useRouter();
  const { userId, subjects } = useWorkspace();
  const [quiz, setQuiz] = useState(initial);
  const [selected, setSelected] = useState(initial.questions[0]?.id ?? null);
  const [options, setOptions] = useState(false);
  const [hosting, setHosting] = useState(false);
  const words = useMemo(() => ({ true: t.true, false: t.false }), [t]);

  const save = useCallback(
    async (patch: Partial<Saved>) => {
      const { error } = await createClient().from("quizzes").update(patch).eq("id", initial.id);
      return !error;
    },
    [initial.id],
  );
  const autosave = useAutosave<Saved>(save, 700);

  const update = (patch: Partial<Saved>) => {
    setQuiz((q) => ({ ...q, ...patch }));
    autosave.schedule(patch);
  };
  const setQuestions = (questions: Question[]) => update({ questions });
  const current = quiz.questions.find((q) => q.id === selected) ?? quiz.questions[0] ?? null;
  const index = current ? quiz.questions.indexOf(current) : -1;
  const changeQuestion = (q: Question) => setQuestions(quiz.questions.map((x) => (x.id === q.id ? q : x)));

  const add = (type: QuestionType) => {
    if (quiz.questions.length >= LIMITS.questions) return;
    const q = newQuestion(type, words);
    const at = index >= 0 ? index + 1 : quiz.questions.length;
    setQuestions([...quiz.questions.slice(0, at), q, ...quiz.questions.slice(at)]);
    setSelected(q.id);
  };
  const duplicate = (q: Question) => {
    const copy = { ...q, id: newId(), choices: q.choices.map((c) => ({ ...c, id: newId() })) };
    const at = quiz.questions.indexOf(q) + 1;
    setQuestions([...quiz.questions.slice(0, at), copy, ...quiz.questions.slice(at)]);
    setSelected(copy.id);
  };
  const remove = (q: Question) => {
    const at = quiz.questions.indexOf(q);
    const rest = quiz.questions.filter((x) => x.id !== q.id);
    setQuestions(rest);
    setSelected(rest[Math.min(at, rest.length - 1)]?.id ?? null);
  };

  const ready = quiz.questions.filter((q) => !issuesOf(q).length).length;
  const notReady = quiz.questions.length - ready;

  const host = async () => {
    if (!ready) return blob.say(t.errors.empty, { mood: "thinking" });
    setHosting(true);
    await autosave.flush();
    try {
      const game = await api.createGame(quiz.id);
      router.push(`/live/${game.id}`);
    } catch {
      setHosting(false);
      blob.say(t.errors.failed, { mood: "worried" });
    }
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: t.nav, href: "/quiz", icon: <BadgeQuestionMark className="size-3.5 text-ink-3" /> },
          { label: quiz.title.trim() || t.untitled },
        ]}
        actions={
          <>
            <SaveIndicator state={autosave.state} />
            <Button variant="ghost" size="sm" onClick={() => setOptions(true)} title={t.editor.settings}>
              <Settings2 className="size-4" /> <span className="max-sm:hidden">{t.editor.settings}</span>
            </Button>
            <Button variant="blob" size="sm" onClick={() => void host()} loading={hosting} disabled={!ready}>
              <Play className="size-4" /> {t.editor.host}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        {/* The questions */}
        <aside className="flex shrink-0 flex-col border-line max-lg:border-b lg:w-[264px] lg:border-r">
          <div className="flex flex-col gap-1.5 px-3 pb-2 pt-3 max-lg:hidden">
            <input value={quiz.title} onChange={(e) => update({ title: e.target.value.slice(0, LIMITS.title) })} placeholder={t.editor.titlePlaceholder} className="w-full rounded-lg bg-transparent px-1.5 py-1 font-display text-[18px] font-bold tracking-[-0.01em] text-ink outline-none placeholder:text-ink-3 hover:bg-hover/60 focus:bg-hover/60" aria-label={t.editor.titlePlaceholder} />
            <textarea value={quiz.description} onChange={(e) => update({ description: e.target.value.slice(0, LIMITS.description) })} placeholder={t.editor.descriptionPlaceholder} rows={2} className="w-full resize-none rounded-lg bg-transparent px-1.5 py-1 text-[12.5px] text-ink-2 outline-none placeholder:text-ink-3 hover:bg-hover/60 focus:bg-hover/60" aria-label={t.editor.descriptionPlaceholder} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2 max-lg:flex max-lg:items-center max-lg:gap-2 max-lg:overflow-x-auto max-lg:py-2">
            <div className="max-lg:hidden">
              <SortableList
                items={quiz.questions}
                onMove={setQuestions}
                className="flex flex-col gap-1.5"
                render={(q, i, handle) => <RailItem q={q} i={i} active={q.id === current?.id} onClick={() => setSelected(q.id)} dragRef={handle.ref} dragProps={handle.props} dragging={handle.dragging} t={t} />}
              />
            </div>
            <div className="flex gap-1.5 lg:hidden">
              {quiz.questions.map((q, i) => (
                <button key={q.id} type="button" onClick={() => setSelected(q.id)} className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl text-[14px] font-bold", q.id === current?.id ? "bg-blob text-white" : "bg-raised text-ink-2 shadow-card")}>
                  {i + 1}
                  {issuesOf(q).length > 0 && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-paper bg-[#d99000]" />}
                </button>
              ))}
            </div>
            <AddQuestion onAdd={add} t={t} compact={false} disabled={quiz.questions.length >= LIMITS.questions} />
          </div>
          {notReady > 0 && (
            <p className="mx-3 mb-3 flex items-start gap-1.5 rounded-xl bg-[#fff4e0] px-2.5 py-2 text-[11.5px] font-medium text-[#9a5b00] max-lg:hidden dark:bg-[#3a2a10] dark:text-[#f0b860]">
              <TriangleAlert className="mt-px size-3.5 shrink-0" /> {t.editor.notReady(notReady)}
            </p>
          )}
        </aside>

        {/* The question */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(90%_60%_at_50%_0%,color-mix(in_oklab,var(--blob-soft)_70%,transparent),transparent)] px-4 py-6 sm:px-8">
          <div className="mb-4 flex flex-col gap-1 lg:hidden">
            <input value={quiz.title} onChange={(e) => update({ title: e.target.value.slice(0, LIMITS.title) })} placeholder={t.editor.titlePlaceholder} className="w-full bg-transparent font-display text-[20px] font-bold text-ink outline-none placeholder:text-ink-3" />
          </div>
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
                <QuestionEditor question={current} index={index} onChange={changeQuestion} userId={userId} t={t} />
                <div className="mx-auto mt-6 max-w-[920px] lg:hidden">
                  <Panel q={current} onChange={changeQuestion} onDuplicate={() => duplicate(current)} onDelete={quiz.questions.length > 1 ? () => remove(current) : undefined} t={t} words={words} />
                </div>
              </motion.div>
            ) : (
              <div className="grid place-items-center gap-3 py-24 text-center text-ink-3">
                <p>{t.editor.empty}</p>
                <AddQuestion onAdd={add} t={t} compact={false} />
              </div>
            )}
          </AnimatePresence>
        </main>

        {/* Its settings */}
        {current && (
          <aside className="hidden w-[284px] shrink-0 overflow-y-auto border-l border-line px-4 py-4 lg:block">
            <Panel q={current} onChange={changeQuestion} onDuplicate={() => duplicate(current)} onDelete={quiz.questions.length > 1 ? () => remove(current) : undefined} t={t} words={words} />
            <Results games={games} t={t} locale={locale} />
          </aside>
        )}
      </div>

      <OptionsDialog open={options} onClose={() => setOptions(false)} settings={quiz.settings} onChange={(settings) => update({ settings })} subjectId={quiz.subject_id} subjects={subjects.filter((s) => s.kind !== "notebook")} onSubject={(subject_id) => update({ subject_id })} t={t} />
    </>
  );
}

function RailItem({ q, i, active, onClick, dragRef, dragProps, dragging, t }: { q: Question; i: number; active: boolean; onClick: () => void; dragRef: Handle["ref"]; dragProps: Handle["props"]; dragging: boolean; t: T }) {
  const Icon = TYPE_ICONS[q.type];
  const issues = issuesOf(q);
  return (
    <div className={cn("group flex items-stretch gap-1 rounded-2xl border p-1.5 transition-colors", active ? "border-blob/50 bg-blob-soft/60" : "border-transparent hover:bg-hover/70", dragging && "bg-raised shadow-pop")}>
      <button type="button" ref={dragRef} {...dragProps} className="grid w-5 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-3 opacity-0 hover:bg-line group-hover:opacity-100 active:cursor-grabbing" aria-label={t.editor.moveUp}>
        <GripVertical className="size-3.5" />
      </button>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-3">
          <span className={cn("grid size-5 place-items-center rounded-md text-[11px] font-bold", active ? "bg-blob text-white" : "bg-line text-ink-2")}>{i + 1}</span>
          <Icon className="size-3.5" /> {t.types[q.type]}
          <span className="ml-auto tabular-nums">{t.seconds(q.time)}</span>
          {issues.length > 0 && <TriangleAlert className="size-3.5 text-[#d99000]" aria-label={t.editor.issues[issues[0]]} />}
        </span>
        <span className={cn("line-clamp-2 text-[13px] font-medium leading-snug", q.text ? "text-ink" : "text-ink-3")}>{q.text || t.editor.questionPlaceholder}</span>
        {(q.type === "quiz" || q.type === "poll" || q.type === "truefalse" || q.type === "puzzle") && (
          <span className="flex gap-1">
            {q.choices.map((c, k) => (
              <span key={c.id} className={cn("grid h-4 flex-1 place-items-center rounded", q.type !== "poll" && q.type !== "puzzle" && !c.correct && "opacity-45")} style={{ background: styleAt(k).color }}>
                <Shape shape={styleAt(k).shape} className="size-2.5" />
              </span>
            ))}
          </span>
        )}
      </button>
    </div>
  );
}

function AddQuestion({ onAdd, t, disabled }: { onAdd: (type: QuestionType) => void; t: T; compact?: boolean; disabled?: boolean }) {
  return (
    <Popover
      label={t.editor.addType}
      trigger={(props) => (
        <button {...props} type="button" disabled={disabled} className="mt-2 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-2 px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink disabled:opacity-40 max-lg:mt-0 max-lg:w-auto max-lg:whitespace-nowrap">
          <Plus className="size-4" /> {t.editor.add}
        </button>
      )}
    >
      {(close) => (
        <div className="grid w-[300px] gap-0.5 p-1">
          {QUESTION_TYPES.map((type, i) => {
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onAdd(type);
                }}
                className="flex items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: styleAt(i).color }}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">{t.types[type]}</span>
                  <span className="block text-[12px] leading-snug text-ink-3">{t.typeHints[type]}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

const POINTS: PointsMode[] = ["standard", "double", "none"];

function Panel({ q, onChange, onDuplicate, onDelete, t, words }: { q: Question; onChange: (q: Question) => void; onDuplicate: () => void; onDelete?: () => void; t: T; words: { true: string; false: string } }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.editor.changeType}</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {QUESTION_TYPES.map((type, i) => {
            const Icon = TYPE_ICONS[type];
            const on = q.type === type;
            return (
              <button key={type} type="button" onClick={() => onChange(convertQuestion(q, type, words))} aria-pressed={on} title={t.typeHints[type]} className={cn("flex items-center gap-2 rounded-xl border px-2 py-2 text-left text-[12px] font-semibold leading-tight transition-colors", on ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")} style={on ? { background: styleAt(i).color } : undefined}>
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0">{t.types[type]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.editor.time}</h3>
        <div className="flex flex-wrap gap-1.5">
          {TIME_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => onChange({ ...q, time: s })} aria-pressed={q.time === s} className={cn("h-8 rounded-full px-3 text-[12.5px] font-semibold tabular-nums transition-colors", q.time === s ? "bg-ink text-paper" : "bg-hover text-ink-2 hover:bg-line")}>
              {t.seconds(s)}
            </button>
          ))}
        </div>
      </section>

      {q.type !== "poll" && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.editor.pointsLabel}</h3>
          <Segmented value={q.points} onChange={(points) => onChange({ ...q, points })} label={t.editor.pointsLabel} options={POINTS.map((p) => ({ value: p, label: t.pointsShort[p], title: t.points[p] }))} size="sm" className="self-start" />
        </section>
      )}

      {q.type === "quiz" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-hover/50">
          <input type="checkbox" checked={q.multi} onChange={(e) => onChange({ ...q, multi: e.target.checked })} className="mt-0.5 size-4 accent-[var(--blob)]" />
          <span>
            <span className="block text-[13px] font-semibold text-ink">{t.editor.multi}</span>
            <span className="block text-[11.5px] text-ink-3">{t.editor.multiHint}</span>
          </span>
        </label>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.editor.explain}</h3>
        <textarea value={q.explain} onChange={(e) => onChange({ ...q, explain: e.target.value.slice(0, LIMITS.explain) })} rows={3} placeholder={t.editor.explainPlaceholder} className={cn(inputClass, "resize-none py-2 text-[13px]")} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onDuplicate}>
          <Copy className="size-3.5" /> {t.editor.duplicate}
        </Button>
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:bg-danger/10 hover:text-danger">
            <Trash2 className="size-3.5" /> {t.editor.delete}
          </Button>
        )}
      </div>
    </div>
  );
}

function Results({ games, t, locale }: { games: GameSummary[]; t: T; locale: string }) {
  const fmt = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="mt-8 flex flex-col gap-2 border-t border-line pt-5">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
        <BarChart3 className="size-3.5" /> {t.editor.results}
      </h3>
      {games.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">{t.editor.noResults}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {games.map((g) => (
            <li key={g.id}>
              <Link href={`/quiz/report/${g.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-2 hover:bg-hover hover:text-ink">
                <span className="min-w-0 flex-1 truncate">{t.editor.resultRow(g.players, fmt.format(new Date(g.createdAt)))}</span>
                <ChevronRight className="size-3.5 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OptionsDialog({
  open,
  onClose,
  settings,
  onChange,
  subjectId,
  subjects,
  onSubject,
  t,
}: {
  open: boolean;
  onClose: () => void;
  settings: QuizSettings;
  onChange: (s: QuizSettings) => void;
  subjectId: string | null;
  subjects: { id: string; name: string; emoji: string | null }[];
  onSubject: (id: string | null) => void;
  t: T;
}) {
  const rows: { key: keyof QuizSettings; label: string; hint?: string }[] = [
    { key: "showOnDevices", label: t.settings.showOnDevices, hint: t.settings.showOnDevicesHint },
    { key: "shuffleQuestions", label: t.settings.shuffleQuestions },
    { key: "shuffleAnswers", label: t.settings.shuffleAnswers },
    { key: "streaks", label: t.settings.streaks, hint: t.settings.streaksHint },
    { key: "names", label: t.settings.names, hint: t.settings.namesHint },
    { key: "music", label: t.settings.music },
  ];
  return (
    <Dialog open={open} onClose={onClose} className="max-w-[460px]" labelledBy="quiz-options">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Settings2 className="size-4 text-blob-ink" />
        <h2 id="quiz-options" className="flex-1 font-display text-[17px] font-semibold">
          {t.editor.settings}
        </h2>
        <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label="×">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-1 px-3 py-3">
        <p className="px-2 pb-1 text-[12px] text-ink-3">{t.editor.settingsHint}</p>
        {rows.map((r) => {
          const on = r.key === "names" ? settings.names === "blob" : (settings[r.key] as boolean);
          return (
            <label key={r.key} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-hover/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-ink">{r.label}</span>
                {r.hint && <span className="block text-[12px] leading-snug text-ink-3">{r.hint}</span>}
              </span>
              <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => onChange({ ...settings, [r.key]: r.key === "names" ? (e.target.checked ? "blob" : "free") : e.target.checked })} />
              <span className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blob", on ? "bg-blob" : "bg-line-2")} aria-hidden>
                <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-card", on ? "right-0.5" : "left-0.5")} />
              </span>
            </label>
          );
        })}
        {subjects.length > 0 && (
          <label className="mt-2 flex items-center gap-3 px-2">
            <span className="flex-1 text-[13.5px] font-medium text-ink">{t.editor.subject}</span>
            <select value={subjectId ?? ""} onChange={(e) => onSubject(e.target.value || null)} className={cn(inputClass, "h-9 max-w-[200px] px-2 text-[13px]")}>
              <option value="">{t.editor.noSubject}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji ? `${s.emoji} ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Dialog>
  );
}
