"use client";

import { formatDistanceStrict } from "date-fns";
import { motion } from "motion/react";
import { ArrowUpRight, Check, FilePlus2, NotebookPen, ScrollText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { blob } from "@/components/blob/bus";
import { PageIcon } from "@/components/shell/Sidebar";
import { useNow } from "@/components/tasks/useNow";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { learnText } from "@/i18n/messages/learn";
import { notesText } from "@/i18n/messages/notes";
import { resolveText, type Text } from "@/i18n/text";
import type { Subject as LearnSubject } from "@/learn/catalog";
import type { Level, SummaryBlock } from "@/learn/types";
import { cheatSheetNote } from "@/notes/convert";
import { guessSubject, insertNote } from "@/notes/pages";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

/** The topic as these pieces need it. */
export type TopicRef = { slug: string; subject: LearnSubject; title: Text };

/** What a saved cheat sheet becomes: title, content, its topic (at this level) and a guessed subject. */
function cheatSheetPage(topic: TopicRef, level: Level, blocks: SummaryBlock[], locale: Locale, subjects: Pick<Subject, "id" | "name" | "kind">[]) {
  const t = notesText[locale].topic;
  const { content, plain_text } = cheatSheetNote(blocks, topic.slug, level, locale);
  return {
    title: t.cheatTitle(resolveText(topic.title, locale), learnText[locale].level(level)),
    content,
    plain_text,
    subject_id: guessSubject(subjects, topic.subject),
    topics: [`${topic.slug}@${level}`],
    tags: [t.cheatTag],
  };
}

/** "Deine Notizen zu diesem Thema" on a topic page: notes linked to the topic, a new one, the cheat sheet as a note. */
export function TopicNotes({ topic, level, summary }: { topic: TopicRef; level: Level; summary: SummaryBlock[] }) {
  const t = useMessages(notesText).topic;
  const locale = useLocale();
  const router = useRouter();
  const now = useNow();
  const { pages, subjects, createPage } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const notes = pages
    .filter((p) => p.kind !== "cv" && p.topics.some((x) => x.split("@")[0] === topic.slug))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  async function create() {
    if (busy) return;
    setBusy(true);
    const page = await createPage({
      kind: "note",
      title: t.noteTitle(resolveText(topic.title, locale)),
      subject_id: guessSubject(subjects, topic.subject),
      topics: [topic.slug],
    });
    setBusy(false);
    if (page) router.push(`/p/${page.id}`);
  }

  return (
    <section className="mt-8 print:hidden" aria-labelledby="topic-notes">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="topic-notes" className="font-display text-[19px] font-semibold tracking-[-0.01em]">
            {t.title}
          </h2>
          <p className="max-w-[640px] text-[13px] text-ink-3">{notes.length ? t.text : t.empty}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.length > 0 && <SaveCheatSheet topic={topic} level={level} summary={summary} compact />}
          <button
            onClick={create}
            disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-paper transition-[transform,opacity] hover:bg-ink/88 active:scale-[0.97] disabled:opacity-60"
          >
            <FilePlus2 className="size-4" /> {t.newNote}
          </button>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {notes.slice(0, 9).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <Link
                href={`/p/${p.id}`}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2.5 shadow-card transition-colors hover:border-line-2"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface">
                  <PageIcon page={p} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{pageTitle(p.title, p.kind, locale)}</span>
                  <span className="block truncate text-[12px] text-ink-3" suppressHydrationWarning>
                    {now ? formatDistanceStrict(new Date(p.updated_at), now, { addSuffix: true, locale: dateLocale(locale) }) : " "}
                  </span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

/** "Spickzettel als Notiz speichern" on the topic page (with the workspace: the note shows up in the sidebar). */
export function SaveCheatSheet({ topic, level, summary, compact }: { topic: TopicRef; level: Level; summary: SummaryBlock[]; compact?: boolean }) {
  const t = useMessages(notesText).topic;
  const locale = useLocale();
  const { subjects, createPage } = useWorkspace();
  const [state, setState] = useState<{ level: Level; id: string | null; busy: boolean }>({ level, id: null, busy: false });
  // Another level is another cheat sheet.
  const saved = state.level === level ? state.id : null;

  async function save() {
    setState({ level, id: null, busy: true });
    const page = await createPage({ kind: "note", ...cheatSheetPage(topic, level, summary, locale, subjects) });
    setState({ level, id: page?.id ?? null, busy: false });
    if (page) {
      blob.say(t.savedSay, { mood: "happy" });
      blob.react("jump", "happy");
    } else blob.say(t.failed, { mood: "worried" });
  }

  return <SaveButton saved={saved} busy={state.busy && state.level === level} onSave={save} compact={compact} />;
}

/** The same in a lesson, which runs without the workspace (full screen). */
export function LessonCheatSheet({ topic, level, summary }: { topic: TopicRef; level: Level; summary: SummaryBlock[] }) {
  const locale = useLocale();
  const t = useMessages(notesText).topic;
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { data: subjects } = await supabase.from("subjects").select("id, name, kind");
    const page = auth.user ? await insertNote(supabase, auth.user.id, cheatSheetPage(topic, level, summary, locale, (subjects ?? []) as Subject[])) : null;
    setBusy(false);
    if (page) setSaved(page.id);
    else setFailed(true);
  }

  return (
    <div className="contents">
      <SaveButton saved={saved} busy={busy} onSave={save} big />
      {failed && (
        <p className="text-[13px] text-danger sm:basis-full" role="alert">
          {t.failed}
        </p>
      )}
    </div>
  );
}

function SaveButton({ saved, busy, onSave, compact, big }: { saved: string | null; busy: boolean; onSave: () => void; compact?: boolean; big?: boolean }) {
  const t = useMessages(notesText).topic;
  const size = big ? "h-11 rounded-xl px-5 text-[14.5px] font-semibold" : "h-9 rounded-lg px-3 text-[13px] font-medium";
  if (saved) {
    return (
      <Link href={`/p/${saved}`} className={cn("flex items-center justify-center gap-1.5 bg-ok/12 text-ok transition-colors hover:bg-ok/20", size)}>
        <Check className="size-4" strokeWidth={2.6} /> {t.saved} · {t.open} <ArrowUpRight className="size-3.5" />
      </Link>
    );
  }
  return (
    <button
      onClick={onSave}
      disabled={busy}
      className={cn(
        "flex items-center justify-center gap-1.5 border border-line bg-raised text-ink shadow-card transition-[transform,border-color,opacity] hover:border-line-2 active:scale-[0.97] disabled:opacity-60",
        size,
      )}
    >
      {compact ? <ScrollText className="size-4" /> : <NotebookPen className="size-4" />} {busy ? t.saving : t.saveCheat}
    </button>
  );
}
