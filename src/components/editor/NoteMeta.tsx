"use client";

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { useEditorState } from "@tiptap/react";
import { format } from "date-fns";
import { Check, ChevronDown, Clock, FolderInput } from "lucide-react";
import { motion } from "motion/react";
import { useDeferredValue, useMemo, useSyncExternalStore } from "react";
import { MenuItem, MenuLabel, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale, formatNumber, intlLocale } from "@/i18n/format";
import { editorText } from "@/i18n/messages/editor";
import { subjectColor } from "@/lib/subjects";
import type { PageMeta, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

// A shared, coarse clock so "Edited 2 min ago" stays fresh without each component polling.
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockSubs = new Set<() => void>();
function subscribeClock(fn: () => void) {
  clockSubs.add(fn);
  clockTimer ??= setInterval(() => {
    clockNow = Date.now();
    clockSubs.forEach((f) => f());
  }, 20_000);
  return () => {
    clockSubs.delete(fn);
    if (!clockSubs.size && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
const readClock = () => (clockNow ||= Date.now());
const serverClock = () => 0;

/** "Edited just now", "Edited 3 min ago", "Edited Monday", "Edited Oct 12" (German: "Bearbeitet vor 3 Min."…). */
function editedLabel(iso: string, now: number, locale: Locale) {
  const t = editorText[locale].meta;
  const then = new Date(iso).getTime();
  const s = Math.max(0, (now - then) / 1000);
  if (s < 45) return t.edited.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return t.edited.minutes(m);
  const h = Math.round(m / 60);
  if (h < 24) return t.edited.hours(h);
  const d = new Date(then);
  const days = Math.round(h / 24);
  if (days === 1) return t.edited.yesterday;
  const opts = { locale: dateLocale(locale) };
  if (days < 7) return t.edited.weekday(format(d, t.weekdayFormat, opts));
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return t.edited.date(format(d, sameYear ? t.dateFormat : t.dateYearFormat, opts));
}

function EditedAgo({ iso }: { iso: string }) {
  const locale = useLocale();
  const now = useSyncExternalStore(subscribeClock, readClock, serverClock);
  // Our own saves bump `updated_at` a moment after the clock last ticked.
  const label = now ? editedLabel(iso, Math.max(now, new Date(iso).getTime()), locale) : null;
  if (!label) return null;
  const exact = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  return (
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap" title={exact}>
      {label}
    </motion.span>
  );
}

const WORD = /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;

function countWords(doc: PMNode) {
  let words = 0;
  doc.descendants((node) => {
    if (node.isText) words += node.text?.match(WORD)?.length ?? 0;
    return true;
  });
  return words;
}

function WordStats({ editor }: { editor: Editor }) {
  const t = useMessages(editorText).meta;
  const locale = useLocale();
  const doc = useEditorState({ editor, selector: ({ editor: e }) => e.state.doc, equalityFn: (a, b) => a === b });
  const deferred = useDeferredValue(doc);
  const words = useMemo(() => countWords(deferred), [deferred]);
  if (!words) return null;
  const minutes = Math.max(1, Math.round(words / 220));
  return (
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      <Dot />
      {t.words(words, formatNumber(words, locale))}
      <span className="hidden items-center gap-1 sm:flex">
        <Dot />
        <Clock className="size-3" /> {t.minRead(minutes)}
      </span>
    </span>
  );
}

function Dot() {
  return <span className="px-0.5 text-ink-3/60">·</span>;
}

function SubjectBadge({ subject }: { subject: Subject }) {
  return (
    <>
      {subject.emoji ? (
        <span className="text-[12px] leading-none">{subject.emoji}</span>
      ) : (
        <span className="size-2 rounded-full" style={{ background: subjectColor(subject.color) }} />
      )}
      <span className="max-w-[160px] truncate" title={subject.name}>
        {subject.name}
      </span>
    </>
  );
}

function SubjectChip({ page }: { page: PageMeta }) {
  const t = useMessages(editorText).meta;
  const { pages, subjects, updatePage } = useWorkspace();
  // Nested pages live under their root page's subject.
  let root = page;
  for (let i = 0; i < 6 && root.parent_id; i++) {
    const parent = pages.find((p) => p.id === root.parent_id);
    if (!parent) break;
    root = parent;
  }
  const subject = subjects.find((s) => s.id === root.subject_id);
  const chip = "flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[12.5px] text-ink-2 transition-colors [@media(hover:none)]:h-8";

  if (page.parent_id) {
    return subject ? (
      <span className={cn(chip, "bg-hover/70")}>
        <SubjectBadge subject={subject} />
      </span>
    ) : null;
  }

  return (
    <Popover
      align="start"
      className="w-[220px]"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={cn(chip, subject ? "bg-hover/70 hover:bg-hover hover:text-ink" : "-ml-1.5 text-ink-3 hover:bg-hover hover:text-ink-2")}
          title={t.changeSubject}
        >
          {subject ? (
            <SubjectBadge subject={subject} />
          ) : (
            <>
              <FolderInput className="size-3.5" /> {t.addSubject}
            </>
          )}
          <ChevronDown className="size-3 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t.subject}</MenuLabel>
          <div className="max-h-[240px] overflow-y-auto">
            {subjects.map((s) => (
              <MenuItem
                key={s.id}
                icon={
                  <span className="grid w-4 place-items-center">
                    {s.emoji ? <span className="text-[13px]">{s.emoji}</span> : <span className="block size-2 rounded-full" style={{ background: subjectColor(s.color) }} />}
                  </span>
                }
                shortcut={page.subject_id === s.id ? <Check className="size-3.5" /> : undefined}
                onSelect={() => {
                  updatePage(page.id, { subject_id: s.id });
                  close();
                }}
              >
                <span title={s.name}>{s.name}</span>
              </MenuItem>
            ))}
            <MenuItem
              icon={
                <span className="grid w-4 place-items-center">
                  <span className="block size-2 rounded-full border border-ink-3" />
                </span>
              }
              shortcut={!page.subject_id ? <Check className="size-3.5" /> : undefined}
              onSelect={() => {
                updatePage(page.id, { subject_id: null });
                close();
              }}
            >
              {t.noSubject}
            </MenuItem>
          </div>
        </>
      )}
    </Popover>
  );
}

/** Subject · Edited 2 min ago · 312 words · 2 min read */
export function NoteMeta({ page, editor }: { page: PageMeta; editor: Editor | null }) {
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
      <SubjectChip page={page} />
      <EditedAgo iso={page.updated_at} />
      {editor && <WordStats editor={editor} />}
    </div>
  );
}
