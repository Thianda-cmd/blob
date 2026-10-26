"use client";

import { startOfDay } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { CalendarOff, Check, ChevronDown, GraduationCap, RefreshCw, School, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Timetable, TimetableLesson } from "@/calendar/bta";
import { deviceTimeZone, fromYmd, ymd } from "@/calendar/time";
import { importedAfter, lessonTitle, planImport, planRemoveImport, suggestSubjects, type SubjectChoice, type TitleStyle } from "@/calendar/timetable";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Input";
import { Popover } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { usePhone } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { subjectsText } from "@/i18n/messages/subjects";
import { timetableText } from "@/i18n/messages/timetable";
import { SUBJECT_COLOR_KEYS, subjectColor } from "@/lib/subjects";
import type { Subject, SubjectColor } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { fmt } from "./describe";
import type { CalendarStore } from "./useCalendarStore";

type T = (typeof timetableText)["en"];

/** A subject row's choice: none, one of your subjects, or a new one made at import. */
type Pick_ = { code: string; name: string; part: string | null; link: string; color: SubjectColor | null };

const REMINDERS = [null, 5, 10, 15] as const;

/**
 * Imports the class timetable from bta.bojes.org: a preview of the week, how the lessons should be
 * named and coloured and which of your subjects they belong to, then one undoable change.
 */
export function TimetableImport({ open, onClose, store, onDone }: { open: boolean; onClose: () => void; store: CalendarStore; onDone: (from: Date, lessons: number) => void }) {
  const phone = usePhone();
  const t = useMessages(timetableText);
  const body = open ? <ImportBody store={store} onClose={onClose} onDone={onDone} /> : null;
  if (phone) {
    return (
      <Sheet open={open} onClose={onClose} label={t.title} full>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} className="max-w-[780px]!" labelledBy="timetable-title">
      {body}
    </Dialog>
  );
}

type Load = { state: "loading" } | { state: "error"; offline: boolean } | { state: "ready"; tt: Timetable };

function ImportBody({ store, onClose, onDone }: { store: CalendarStore; onClose: () => void; onDone: (from: Date, lessons: number) => void }) {
  const t = useMessages(timetableText);
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const fetchIt = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/timetable/bta", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setLoad({ state: "ready", tt: (await res.json()) as Timetable });
    } catch {
      setLoad({ state: "error", offline: typeof navigator !== "undefined" && navigator.onLine === false });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once when the dialog opens
    void fetchIt();
  }, [fetchIt]);

  return (
    <div className="flex max-h-[min(88dvh,860px)] flex-col max-sm:max-h-none">
      <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5 max-sm:pt-1">
        <motion.span
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
          className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blob-soft text-blob-ink"
        >
          <School className="size-5" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <h2 id="timetable-title" className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ink">
            {t.title}
          </h2>
          <p className="truncate text-[12.5px] text-ink-3">
            {load.state === "ready" ? (
              <>
                {t.source(load.tt.className)}
                {load.tt.updated && <> · {t.updated(load.tt.updated)}</>}
              </>
            ) : (
              t.school
            )}
          </p>
        </div>
      </header>

      {load.state === "loading" && (
        <div className="grid place-items-center gap-3 px-6 py-16">
          <GooSpinner size={64} label={t.loading} />
          <p className="text-[13.5px] text-ink-2">{t.loading}</p>
        </div>
      )}
      {load.state === "error" && (
        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
          <Blob size={84} mood="worried" />
          <p className="max-w-[340px] text-[13.5px] text-ink-2">{load.offline ? t.offline : t.failed}</p>
          <Button variant="secondary" size="sm" onClick={() => void fetchIt()}>
            <RefreshCw className="size-3.5" /> {t.retry}
          </Button>
        </div>
      )}
      {load.state === "ready" && <Ready tt={load.tt} store={store} onClose={onClose} onDone={onDone} t={t} />}
    </div>
  );
}

function Ready({ tt, store, onClose, onDone, t }: { tt: Timetable; store: CalendarStore; onClose: () => void; onDone: (from: Date, lessons: number) => void; t: T }) {
  const locale = useLocale();
  const { subjects, userId, createSubject } = useWorkspace();
  const [fromText, setFromText] = useState(() => ymd(new Date()));
  const from = fromYmd(fromText) ?? startOfDay(new Date());
  const [titles, setTitles] = useState<TitleStyle>("name");
  const [breaks, setBreaks] = useState(true);
  const [exams, setExams] = useState(true);
  const [reminder, setReminder] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [picks, setPicks] = useState<Pick_[]>(() =>
    suggestSubjects(tt, subjects).map((s) => ({ code: s.code, name: s.name, part: s.part, link: s.choice.subjectId ?? "", color: s.choice.color })),
  );

  const choices = useMemo(() => {
    const out: Record<string, SubjectChoice> = {};
    for (const p of picks) out[p.code] = { subjectId: p.link && p.link !== "new" ? p.link : null, color: p.color };
    return out;
  }, [picks]);

  const ctx = useMemo(() => ({ userId, timeZone: deviceTimeZone(), events: store.events, tasks: store.tasks.tasks, newId: uid }), [userId, store.events, store.tasks.tasks]);
  const preview = useMemo(() => planImport(tt, { from, titles, subjects: choices, breaks, exams, reminder }, ctx), [tt, from, titles, choices, breaks, exams, reminder, ctx]);
  const earlier = useMemo(() => importedAfter(store.events, tt, from), [store.events, tt, from]);
  const futureExams = tt.exams.filter((x) => x.date >= ymd(from)).length;

  const colorOf = (code: string) => {
    const p = picks.find((x) => x.code === code);
    if (p?.color) return subjectColor(p.color);
    const s = p?.link ? subjects.find((x) => x.id === p.link) : undefined;
    return s ? subjectColor(s.color) : "var(--blob)";
  };

  const setPick = (code: string, patch: Partial<Pick_>) => setPicks((list) => list.map((p) => (p.code === code ? { ...p, ...patch } : p)));

  const run = async () => {
    setBusy(true);
    try {
      // New subjects first (one per name: theory and practice of a field share theirs).
      const made = new Map<string, string>();
      const final: Record<string, SubjectChoice> = { ...choices };
      for (const p of picks) {
        if (p.link !== "new") continue;
        let id = made.get(p.name);
        if (!id) {
          const s = await createSubject({ name: p.name.slice(0, 60), color: p.color ?? "ink" });
          if (s) made.set(p.name, (id = s.id));
        }
        final[p.code] = { subjectId: id ?? null, color: id ? null : p.color };
      }
      const result = planImport(tt, { from, titles, subjects: final, breaks, exams, reminder }, ctx);
      store.run(result.plan, t.undoLabel);
      onDone(from, result.lessons);
      blob.react("celebrate", "excited", 2800, "cap");
      blob.say(t.done(result.lessons), { mood: "love", ms: 5200, accessory: "cap" });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    store.run(planRemoveImport(tt, store.events, from), t.removed);
    blob.react("squish", "happy");
    onClose();
  };

  const dateLabel = fmt(from, locale === "de" ? "d. MMM yyyy" : "MMM d, yyyy", locale);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <WeekPreview tt={tt} titles={titles} colorOf={colorOf} t={t} />

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1fr]">
          <section className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink-2">{t.from}</span>
              <input type="date" value={fromText} min={tt.year.from} max={tt.year.to} onChange={(e) => e.target.value && setFromText(e.target.value)} className={cn(inputClass, "h-9 px-2.5 text-[13.5px]")} />
              <span className="text-[11.5px] text-ink-3">{t.fromHint}</span>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink-2">{t.names}</span>
              <Segmented value={titles} onChange={setTitles} label={t.names} options={(["name", "code"] as const).map((v) => ({ value: v, label: t.nameStyle[v] }))} className="self-start" />
            </div>
            <Toggle checked={breaks} onChange={setBreaks} label={t.breaks} hint={t.breaksHint} icon={<CalendarOff className="size-4" />} />
            <Toggle checked={exams} onChange={setExams} label={t.exams(futureExams)} hint={t.examsHint} icon={<GraduationCap className="size-4" />} disabled={!futureExams} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink-2">{t.reminder}</span>
              <select value={reminder ?? ""} onChange={(e) => setReminder(e.target.value ? Number(e.target.value) : null)} className={cn(inputClass, "h-9 px-2 text-[13.5px]")}>
                {REMINDERS.map((m) => (
                  <option key={m ?? "off"} value={m ?? ""}>
                    {m === null ? t.reminderOff : t.reminderMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-2">{t.subjects}</span>
            <span className="text-[11.5px] text-ink-3">{t.subjectHint}</span>
            <ul className="mt-1 flex flex-col gap-1">
              {picks.map((p, i) => (
                <motion.li
                  key={p.code}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.03, type: "spring", stiffness: 420, damping: 32 }}
                  className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-hover/60"
                >
                  <ColorPick value={p.color} fallback={colorOf(p.code)} onChange={(color) => setPick(p.code, { color })} />
                  <span className="w-12 shrink-0 truncate font-mono text-[11.5px] font-medium text-ink-3">{p.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={lessonTitle(p, "name")}>
                    {lessonTitle(p, "name")}
                  </span>
                  <SubjectSelect value={p.link} name={p.name} subjects={subjects} t={t} onChange={(link) => setPick(p.code, { link, color: link && link !== "new" ? null : (p.color ?? suggestColor(p.code, picks)) })} />
                </motion.li>
              ))}
            </ul>
          </section>
        </div>

        <p className="mt-5 rounded-xl bg-blob-soft/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-blob-ink">{t.repeatNote}</p>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
        {earlier > 0 && <p className="basis-full text-[12px] text-ink-3">{t.replaces(earlier, dateLabel)}</p>}
        <div className="min-w-[200px] flex-1">
          {preview.lessons ? (
            <p className="text-[13px] font-medium text-ink">{t.summary(preview.lessons, preview.breaks, preview.exams)}</p>
          ) : (
            <p className="text-[13px] text-ink-2">{t.nothing}</p>
          )}
        </div>
        {earlier > 0 &&
          (confirmRemove ? (
            <Button variant="danger" size="sm" onClick={remove}>
              <Trash2 className="size-3.5" /> {t.removeConfirm(dateLabel)}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} title={t.remove}>
              <Trash2 className="size-3.5" /> <span className="max-sm:hidden">{t.remove}</span>
            </Button>
          ))}
        <Button variant="secondary" size="md" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button variant="blob" size="md" onClick={() => void run()} loading={busy} disabled={!preview.lessons}>
          <Check className="size-4" /> {t.importButton}
        </Button>
      </footer>
    </>
  );
}

/** A colour not taken by another row yet (for a row unlinked from its subject). */
function suggestColor(code: string, picks: Pick_[]): SubjectColor {
  const used = new Set(picks.filter((p) => p.code !== code && p.color).map((p) => p.color));
  return SUBJECT_COLOR_KEYS.find((c) => c !== "ink" && !used.has(c)) ?? "sky";
}

function SubjectSelect({ value, name, subjects, onChange, t }: { value: string; name: string; subjects: Subject[]; onChange: (v: string) => void; t: T }) {
  const own = subjects.filter((s) => s.kind !== "notebook");
  return (
    <span className="relative w-[150px] shrink-0 max-sm:w-[120px]">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-8 appearance-none truncate py-0 pl-2.5 pr-7 text-[12.5px]", !value && "text-ink-3")} aria-label={name}>
        <option value="">{t.noSubject}</option>
        {own.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji ? `${s.emoji} ` : ""}
            {s.name}
          </option>
        ))}
        <option value="new">{t.newSubject(name.length > 28 ? `${name.slice(0, 26)}…` : name)}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
    </span>
  );
}

function ColorPick({ value, fallback, onChange }: { value: SubjectColor | null; fallback: string; onChange: (c: SubjectColor | null) => void }) {
  const names = useMessages(subjectsText).colors;
  const t = useMessages(timetableText);
  return (
    <Popover
      role="dialog"
      label={t.color}
      trigger={(props) => (
        <button {...props} type="button" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-line" aria-label={t.color} title={t.color}>
          <span className="size-3.5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: value ? subjectColor(value) : fallback }} />
        </button>
      )}
    >
      {(close) => (
        <div className="grid grid-cols-4 gap-1.5 p-2">
          {SUBJECT_COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                close();
              }}
              className={cn("grid size-8 place-items-center rounded-full transition-transform hover:scale-110", value === c && "ring-2 ring-ink/30 ring-offset-2 ring-offset-raised")}
              style={{ background: subjectColor(c) }}
              aria-label={names[c]}
              title={names[c]}
            >
              {value === c && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function Toggle({ checked, onChange, label, hint, icon, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:bg-hover/50", disabled && "pointer-events-none opacity-50")}>
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span className="block text-[11.5px] leading-snug text-ink-3">{hint}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked && !disabled} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blob", checked && !disabled ? "bg-blob" : "bg-line-2")} aria-hidden>
        <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-card", checked && !disabled ? "right-0.5" : "left-0.5")} />
      </span>
    </label>
  );
}

/** Monday to Friday as the school has it, lessons in their colours. */
function WeekPreview({ tt, titles, colorOf, t }: { tt: Timetable; titles: TitleStyle; colorOf: (code: string) => string; t: T }) {
  const top = Math.min(...tt.lessons.map((l) => l.start));
  const bottom = Math.max(...tt.lessons.map((l) => l.end));
  const scale = 0.56;
  const height = (bottom - top) * scale;
  // Lessons sharing a slot (one per quarter) sit side by side.
  const lanes = useMemo(() => {
    const out = new Map<string, { lane: number; of: number }>();
    for (let d = 0; d < 5; d++) {
      const day = tt.lessons.filter((l) => l.day === d);
      for (const l of day) {
        const together = day.filter((o) => o.start < l.end && l.start < o.end);
        out.set(l.id, { lane: together.indexOf(l), of: together.length });
      }
    }
    return out;
  }, [tt.lessons]);
  const hours = [];
  for (let h = Math.ceil(top / 60); h * 60 <= bottom; h++) hours.push(h);
  let n = 0;

  return (
    <section aria-label={t.week}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink-2">{t.week}</span>
        <span className="flex items-center gap-3 text-[11px] text-ink-3">
          <span className="flex items-center gap-1">
            <Badge>14T</Badge> {t.fortnightly}
          </span>
          <span className="flex items-center gap-1 max-sm:hidden">
            <Badge>Q1</Badge> {t.quarter(1)}
          </span>
        </span>
      </div>
      <div className="flex rounded-2xl border border-line bg-surface p-2">
        <div className="relative w-8 shrink-0" style={{ height: height + 22 }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-ink-3" style={{ top: 22 + (h * 60 - top) * scale }}>
              {h}
            </span>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-5 gap-1">
          {t.weekdays.map((name, d) => (
            <div key={name} className="min-w-0">
              <div className="h-[22px] text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3">{name}</div>
              <div className="relative rounded-lg bg-[linear-gradient(to_bottom,var(--line)_1px,transparent_1px)]" style={{ height, backgroundSize: `100% ${60 * scale}px`, backgroundPosition: `0 ${((60 - (top % 60)) % 60) * scale}px` }}>
                <AnimatePresence>
                  {tt.lessons
                    .filter((l) => l.day === d)
                    .map((l) => {
                      const lane = lanes.get(l.id) ?? { lane: 0, of: 1 };
                      const color = colorOf(l.code);
                      return (
                        <motion.div
                          key={l.id}
                          initial={{ opacity: 0, scale: 0.7, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: 0.05 + n++ * 0.035, type: "spring", stiffness: 380, damping: 20 }}
                          whileHover={{ scale: 1.04, zIndex: 2 }}
                          title={lessonTooltip(l)}
                          className="absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-ink shadow-card"
                          style={{
                            top: (l.start - top) * scale,
                            height: Math.max(18, (l.end - l.start) * scale - 2),
                            left: `${(lane.lane / lane.of) * 100}%`,
                            width: `calc(${100 / lane.of}% - ${lane.of > 1 ? 2 : 0}px)`,
                            borderLeftColor: color,
                            background: `color-mix(in oklab, ${color} 16%, var(--raised))`,
                          }}
                        >
                          <span className="flex items-start gap-1">
                            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight">{titles === "code" ? l.code : l.name}</span>
                            {l.rhythm.kind !== "weekly" && <Badge>{l.rhythm.kind === "fortnightly" ? "14T" : `Q${l.rhythm.nr}`}</Badge>}
                          </span>
                          {(l.end - l.start) * scale > 34 && <span className="block truncate text-[10px] leading-tight text-ink-2">{[titles === "name" ? l.part : null, l.room].filter(Boolean).join(" · ")}</span>}
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function lessonTooltip(l: TimetableLesson) {
  const time = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  return [`${l.code} · ${lessonTitle(l, "name")}`, `${time(l.start)}–${time(l.end)} · ${l.room}`, l.teachers.join(", "), l.note, l.correction].filter(Boolean).join("\n");
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-[5px] bg-ink/8 px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-ink-2 dark:bg-white/10">{children}</span>;
}
