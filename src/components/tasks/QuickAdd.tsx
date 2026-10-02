"use client";

import { AnimatePresence, motion, useAnimate } from "motion/react";
import { CalendarDays, CornerDownLeft, Plus } from "lucide-react";
import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { blob } from "@/components/blob/bus";
import { Kbd } from "@/components/ui/Kbd";
import { useLocale, useMessages } from "@/i18n/client";
import { tasksText } from "@/i18n/messages/tasks";
import {
  dueAt,
  formatDue,
  formatTime,
  isDefaultTime,
  matchSubject,
  parseQuickAdd,
  suggestSubjects,
  type QuickAddToken,
  type TimeOfDay,
} from "@/lib/tasks";
import type { Subject, TaskKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DuePicker, KIND_ICON, KindPicker, SubjectDot, SubjectPicker } from "./pickers";
import { useNow } from "./useNow";
import type { NewTask } from "./useTaskStore";

export type QuickAddHandle = {
  focus: () => void;
  /** Put text in the box (e.g. from an example) and focus it. */
  fill: (text: string) => void;
};

type Source = "parsed" | "manual" | "preset" | "none";
type Overrides = { due?: { day: Date; time: TimeOfDay | null } | null; kind?: TaskKind; subjectId?: string | null };

let monthFirstCache: boolean | undefined;
/** US English readers write "10/12" for October 12. */
function prefersMonthFirst() {
  if (monthFirstCache === undefined) {
    try {
      monthFirstCache = /^en-US\b/i.test(Intl.DateTimeFormat().resolvedOptions().locale);
    } catch {
      monthFirstCache = false;
    }
  }
  return monthFirstCache;
}

/**
 * One line to add a task. Understands dates ("fri", "tomorrow", "12.10", "in 3 days"; "Fr", "morgen",
 * "in 3 Tagen"), kinds ("test", "project", "Referat", "HA") and "#subject", and previews what it
 * understood as chips. German or English: the reader's language comes first, the other one works too.
 */
export function QuickAdd({
  onAdd,
  subjects,
  defaultSubjectId = null,
  defaultDay = null,
  autoFocus,
  size = "md",
  placeholder,
  className,
  ref,
}: {
  onAdd: (task: NewTask) => unknown;
  subjects: Subject[];
  /** Pre-selected subject (subject page, active filter). Typing "#other" still wins. */
  defaultSubjectId?: string | null;
  /** Pre-selected day (e.g. the day you filtered by). */
  defaultDay?: Date | null;
  autoFocus?: boolean;
  size?: "md" | "sm";
  placeholder?: string;
  className?: string;
  ref?: Ref<QuickAddHandle>;
}) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const now = useNow();
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [menus, setMenus] = useState(0);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [ac, setAc] = useState({ index: 0, dismissed: false });
  const sm = size === "sm";
  const listId = useId();

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    fill: (t: string) => {
      setText(t);
      setCaret(t.length);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(t.length, t.length);
      });
    },
  }));

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // --- What we understood ------------------------------------------------------
  const parsed = useMemo(() => {
    if (!now || !text.trim()) return null;
    return parseQuickAdd(text, new Date(now), {
      locale,
      monthFirst: locale === "en" && prefersMonthFirst(),
      isSubject: (tag) => !!matchSubject(tag, subjects),
    });
  }, [text, now, subjects, locale]);

  const parsedSubject = parsed?.subject ? matchSubject(parsed.subject, subjects) : null;

  const kind: TaskKind = overrides.kind ?? parsed?.kind ?? "homework";
  const kindSource: Source = overrides.kind ? "manual" : parsed?.kind ? "parsed" : "none";

  const presetSubject = defaultSubjectId && subjects.some((s) => s.id === defaultSubjectId) ? defaultSubjectId : null;
  const subjectId = overrides.subjectId !== undefined ? overrides.subjectId : (parsedSubject?.id ?? presetSubject);
  const subjectSource: Source =
    overrides.subjectId !== undefined ? (overrides.subjectId ? "manual" : "none") : parsedSubject ? "parsed" : presetSubject ? "preset" : "none";
  const subject = subjects.find((s) => s.id === subjectId) ?? null;

  let due: Date | null = null;
  let dueSource: Source = "none";
  if (overrides.due !== undefined) {
    due = overrides.due ? dueAt(overrides.due.day, kind, overrides.due.time) : null;
    dueSource = overrides.due ? "manual" : "none";
  } else if (parsed?.day) {
    due = dueAt(parsed.day, kind, parsed.time);
    dueSource = "parsed";
  } else if (defaultDay) {
    due = dueAt(defaultDay, kind);
    dueSource = "preset";
  }

  const title = (parsed ? parsed.title : text).trim();

  // --- "#" autocomplete ---------------------------------------------------------
  const acMatch = focused && !ac.dismissed ? /(?:^|\s)#([\p{L}\p{N}_-]*)$/u.exec(text.slice(0, caret)) : null;
  const suggestions = acMatch ? suggestSubjects(acMatch[1], subjects) : [];
  const acOpen = suggestions.length > 0;
  const acIndex = Math.min(ac.index, Math.max(0, suggestions.length - 1));

  function pickSuggestion(s: Subject) {
    if (!acMatch) return;
    const hash = acMatch.index + acMatch[0].indexOf("#");
    const tag = `#${s.name.replace(/\s+/g, "-")}`;
    const rest = text.slice(caret).replace(/^\S*/, "");
    const next = `${text.slice(0, hash)}${tag}${rest.startsWith(" ") ? "" : " "}${rest}`;
    const pos = hash + tag.length + 1;
    setText(next);
    setCaret(pos);
    setAc({ index: 0, dismissed: false });
    setOverrides((o) => ({ ...o, subjectId: undefined }));
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  }

  // --- Highlighting mirror -------------------------------------------------------
  useLayoutEffect(() => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  });

  const segments = useMemo(() => splitByTokens(text, parsed?.tokens ?? []), [text, parsed]);

  // --- Actions --------------------------------------------------------------------
  function submit() {
    if (!title) {
      if (scope.current) animate(scope.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.38 });
      inputRef.current?.focus();
      return;
    }
    onAdd({ title, kind, due_at: due ? due.toISOString() : null, subject_id: subjectId });
    setText("");
    setCaret(0);
    setOverrides({});
    setAc({ index: 0, dismissed: false });
    blob.react("squish");
  }

  const refocus = () => requestAnimationFrame(() => inputRef.current?.focus());
  const trackMenu = (open: boolean) => setMenus((n) => Math.max(0, n + (open ? 1 : -1)));
  const expanded = focused || menus > 0 || text.length > 0 || overrides.due !== undefined || !!overrides.kind || overrides.subjectId !== undefined;
  const KindIcon = KIND_ICON[kind];

  return (
    <div
      ref={scope}
      className={cn(
        "relative rounded-xl border bg-raised transition-[border-color,box-shadow] duration-200",
        expanded
          ? "border-blob/55 shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_13%,transparent),var(--shadow-card)]"
          : "border-line shadow-card hover:border-line-2",
        className,
      )}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className={cn("flex items-center gap-2.5", sm ? "h-10 pl-2.5 pr-2" : "h-12 pl-3.5 pr-2.5")}>
        <motion.button
          type="button"
          tabIndex={-1}
          onClick={() => (title ? submit() : inputRef.current?.focus())}
          animate={{ rotate: title ? 90 : 0, scale: title ? 1.06 : 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 20 }}
          className={cn(
            "grid shrink-0 place-items-center rounded-full transition-colors",
            sm ? "size-[18px]" : "size-5",
            title ? "bg-blob text-white" : "border-[1.5px] border-dashed border-line-2 text-ink-3",
          )}
          aria-label={t.addTask}
        >
          <Plus className={sm ? "size-3" : "size-3.5"} strokeWidth={2.6} />
        </motion.button>

        <div className="relative min-w-0 flex-1">
          <div
            ref={mirrorRef}
            aria-hidden
            className={cn("pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-transparent", sm ? "text-[13.5px]" : "text-[14.5px]")}
          >
            <span>
              {segments.map((seg, i) =>
                seg.type === "kind" ? (
                  <span key={i} className="underline decoration-blob/70 decoration-dotted decoration-2 underline-offset-[5px]">
                    {seg.text}
                  </span>
                ) : seg.type ? (
                  <span
                    key={i}
                    className="rounded-[4px] bg-[color-mix(in_oklab,var(--blob)_20%,transparent)] shadow-[0_0_0_2px_color-mix(in_oklab,var(--blob)_20%,transparent)]"
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </span>
          </div>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setAc((a) => ({ index: a.index, dismissed: false }));
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onScroll={(e) => {
              if (mirrorRef.current) mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }}
            onKeyDown={(e) => {
              if (acOpen) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const d = e.key === "ArrowDown" ? 1 : -1;
                  setAc({ index: (acIndex + d + suggestions.length) % suggestions.length, dismissed: false });
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pickSuggestion(suggestions[acIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setAc({ index: 0, dismissed: true });
                  return;
                }
              }
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                if (text || overrides.due !== undefined || overrides.kind || overrides.subjectId !== undefined) {
                  setText("");
                  setOverrides({});
                } else e.currentTarget.blur();
              }
            }}
            placeholder={placeholder ?? (sm ? t.placeholderShort : t.placeholder)}
            maxLength={240}
            className={cn(
              "relative h-9 w-full bg-transparent text-ink caret-blob outline-none placeholder:text-ink-3/90",
              sm ? "text-[13.5px]" : "text-[14.5px]",
            )}
            aria-label={t.newTask}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={acOpen}
            aria-controls={listId}
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <AnimatePresence initial={false}>
          {title && (
            <motion.button
              type="button"
              onClick={submit}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg bg-blob font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-blob-deep active:scale-95",
                sm ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[12.5px]",
              )}
            >
              {t.add}
              <CornerDownLeft className="size-3.5 opacity-80" />
            </motion.button>
          )}
        </AnimatePresence>
        {!title && !sm && focused && (
          <span className="hidden shrink-0 items-center gap-1 text-[11.5px] text-ink-3 sm:flex">
            <Kbd>#</Kbd> {t.hashSubject}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="overflow-hidden"
          >
            <div className={cn("flex flex-wrap items-center gap-1.5 pb-2.5", sm ? "pl-2.5 pr-2" : "pl-[46px] pr-3")}>
              <DuePicker
                align="start"
                value={due ? due.toISOString() : null}
                kind={kind}
                onOpenChange={trackMenu}
                onChange={(iso) => {
                  if (!iso) setOverrides((o) => ({ ...o, due: null }));
                  else {
                    const d = new Date(iso);
                    setOverrides((o) => ({ ...o, due: { day: d, time: isDefaultTime(d, kind) ? null : { h: d.getHours(), m: d.getMinutes() } } }));
                  }
                  refocus();
                }}
                trigger={(props) => (
                  <Chip {...props} source={dueSource} icon={<CalendarDays />}>
                    {due && now ? (
                      <>
                        {formatDue(due, now, locale)}
                        {!isDefaultTime(due, kind) && <span className="opacity-75">{formatTime(due, locale)}</span>}
                      </>
                    ) : (
                      t.date
                    )}
                  </Chip>
                )}
              />
              <KindPicker
                value={kind}
                onOpenChange={trackMenu}
                onChange={(k) => {
                  setOverrides((o) => ({ ...o, kind: k }));
                  refocus();
                }}
                trigger={(props) => (
                  <Chip {...props} source={kindSource} icon={<KindIcon />}>
                    {t.kind[kind]}
                  </Chip>
                )}
              />
              {subjects.length > 0 && (
                <SubjectPicker
                  align="start"
                  value={subjectId}
                  subjects={subjects}
                  onOpenChange={trackMenu}
                  onChange={(id) => {
                    setOverrides((o) => ({ ...o, subjectId: id }));
                    refocus();
                  }}
                  trigger={(props) => (
                    <Chip {...props} source={subjectSource} icon={subject?.emoji ? <span className="text-[12px] leading-none">{subject.emoji}</span> : <SubjectDot subject={subject} />}>
                      {subject ? subject.name : t.subject}
                    </Chip>
                  )}
                />
              )}
              {!text && !sm && (
                <span className="ml-auto hidden truncate text-[11.5px] text-ink-3 md:block">
                  {t.tryBefore}{" "}
                  {t.quickExamples.slice(0, 2).map((ex, i) => (
                    <span key={ex}>
                      {i > 0 && t.tryOr}
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setText(ex);
                          setCaret(ex.length);
                          inputRef.current?.focus();
                        }}
                        className="rounded px-0.5 text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-ink hover:decoration-blob"
                      >
                        {ex}
                      </button>
                    </span>
                  ))}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {acOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: "spring", stiffness: 600, damping: 34 }}
            className={cn("absolute top-[calc(100%-6px)] z-30 w-[220px] rounded-xl border border-line bg-raised p-1 shadow-pop", sm ? "left-8" : "left-10")}
            role="listbox"
            id={listId}
            aria-label={t.subjectsLabel}
          >
            <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-ink-3">{t.subject}</div>
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === acIndex}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setAc({ index: i, dismissed: false })}
                onClick={() => pickSuggestion(s)}
                className={cn("flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2", i === acIndex && "bg-hover text-ink")}
              >
                <span className="grid size-4 place-items-center">{s.emoji ? <span className="text-[13px] leading-none">{s.emoji}</span> : <SubjectDot subject={s} />}</span>
                <span className="flex-1 truncate">{s.name}</span>
                {i === acIndex && <Kbd>Tab</Kbd>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({
  source,
  icon,
  children,
  ...props
}: { source: Source; icon: ReactNode; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-6 max-w-[180px] items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
        source === "parsed" && "border-transparent bg-blob-soft text-blob-ink",
        (source === "manual" || source === "preset") && "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink",
        source === "none" && "border-dashed border-line-2 font-normal text-ink-3 hover:border-ink-3 hover:text-ink-2",
        "aria-expanded:border-blob/60",
      )}
    >
      {icon}
      <span className="flex min-w-0 items-center gap-1 truncate">{children}</span>
    </button>
  );
}

function splitByTokens(text: string, tokens: QuickAddToken[]) {
  const out: { text: string; type?: QuickAddToken["type"] }[] = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start < cursor) continue;
    if (t.start > cursor) out.push({ text: text.slice(cursor, t.start) });
    out.push({ text: text.slice(t.start, t.end), type: t.type });
    cursor = t.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}
