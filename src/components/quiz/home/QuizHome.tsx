"use client";

import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { BadgeQuestionMark, Copy, Ellipsis, NotebookText, Pencil, Play, Plus, Search, Smartphone, Trash2, Tv, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { PageBody, PageHeader, SectionHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { addTile, card, midTone, searchOnPaper } from "@/components/ui/surfaces";
import { PageIcon } from "@/components/shell/Sidebar";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { quizText } from "@/i18n/messages/quiz";
import { createClient } from "@/lib/supabase/client";
import { cn, pageTitle } from "@/lib/utils";
import { DEFAULT_SETTINGS, issuesOf, newQuestion, type Quiz } from "@/quiz/model";
import { sampleQuiz } from "@/quiz/samples";
import { api } from "../api";
import { makeQuizFromNote } from "../fromNote";
import { Shape, styleAt } from "../Shape";

const rise = {
  hidden: { opacity: 0, y: 12 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.04 * i, type: "spring" as const, stiffness: 420, damping: 32 } }),
};

/** /quiz: your quizzes, making a new one (or trying the example), and hosting one live. */
export function QuizHome({ initial }: { initial: Quiz[] }) {
  const t = useMessages(quizText);
  const locale = useLocale();
  const router = useRouter();
  const { userId } = useWorkspace();
  const [quizzes, setQuizzes] = useState(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? quizzes.filter((x) => x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q)) : quizzes;
  }, [quizzes, query]);

  const create = async (example = false) => {
    setBusy(example ? "example" : "new");
    const words = { true: t.true, false: t.false };
    const content = example ? sampleQuiz(locale) : { title: "", description: "", questions: [newQuestion("quiz", words)] };
    const { data, error } = await createClient()
      .from("quizzes")
      .insert({ user_id: userId, title: content.title, description: content.description, questions: content.questions, settings: DEFAULT_SETTINGS })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(null);
      blob.say(t.errors.failed, { mood: "worried" });
      return;
    }
    if (example) blob.react("celebrate", "excited");
    router.push(`/quiz/${data.id}`);
  };

  const fromNote = async (pageId: string) => {
    setBusy(`note:${pageId}`);
    const made = await makeQuizFromNote(pageId, userId);
    if (made === "empty" || made === "failed") {
      setBusy(null);
      blob.say(made === "empty" ? t.fromNote.empty : t.errors.failed, { mood: made === "empty" ? "thinking" : "worried" });
      return;
    }
    blob.react("celebrate", "excited");
    blob.say(t.fromNote.made(made.count), { mood: "happy" });
    router.push(`/quiz/${made.id}`);
  };

  const host = async (quiz: Quiz) => {
    if (!quiz.questions.some((q) => !issuesOf(q).length)) {
      blob.say(t.errors.empty, { mood: "thinking" });
      router.push(`/quiz/${quiz.id}`);
      return;
    }
    setBusy(quiz.id);
    try {
      const game = await api.createGame(quiz.id);
      router.push(`/live/${game.id}`);
    } catch {
      setBusy(null);
      blob.say(t.errors.failed, { mood: "worried" });
    }
  };

  const duplicate = async (quiz: Quiz) => {
    const { data } = await createClient()
      .from("quizzes")
      .insert({ user_id: userId, title: `${quiz.title || t.untitled} (2)`.slice(0, 120), description: quiz.description, cover: quiz.cover, questions: quiz.questions, settings: quiz.settings, subject_id: quiz.subject_id })
      .select("*")
      .single();
    if (data) setQuizzes((list) => [data as Quiz, ...list]);
  };

  const remove = async (quiz: Quiz) => {
    if (!confirm(t.home.deleteConfirm(quiz.title || t.untitled))) return;
    setQuizzes((list) => list.filter((x) => x.id !== quiz.id));
    const { error } = await createClient().from("quizzes").delete().eq("id", quiz.id);
    if (error) setQuizzes((list) => [quiz, ...list]);
    else blob.react("squish", "happy");
  };

  return (
    <>
      <TopBar
        crumbs={[{ label: t.nav, icon: <BadgeQuestionMark className="size-3.5 text-ink-3" /> }]}
        actions={
          // The page's one violet button: a new quiz (the label hides on phones, the + stays).
          <Button variant="blob" size="bar" onClick={() => void create()} loading={busy === "new"} title={t.home.create}>
            <Plus className="size-4" strokeWidth={2.4} />
            <span className="max-sm:sr-only">{t.home.create}</span>
          </Button>
        }
      />
      <PageBody>
        <PageHeader title={t.home.heading} meta={quizzes.length ? t.home.count(quizzes.length) : undefined}>
          <Button variant="secondary" size="md" className="shrink-0" onClick={() => setPicking(true)}>
            <NotebookText className="size-4" /> {t.fromNote.button}
          </Button>
          <a href="/play" target="_blank" rel="noopener" className={buttonClass("secondary", "md", "shrink-0")}>
            <Smartphone className="size-4" /> {t.home.join}
          </a>
        </PageHeader>

        {quizzes.length === 0 ? (
          <EmptyStart onNew={() => void create()} onExample={() => void create(true)} busy={busy} />
        ) : (
          <section>
            {quizzes.length > 6 && (
              <label className="relative mb-4 flex max-w-[360px] items-center">
                <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.home.search} aria-label={t.home.search} className={cn(searchOnPaper, "w-full pl-9")} />
              </label>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((quiz, i) => (
                    <QuizCard key={quiz.id} quiz={quiz} index={i} busy={busy === quiz.id} onHost={() => void host(quiz)} onDuplicate={() => void duplicate(quiz)} onDelete={() => void remove(quiz)} />
                  ))}
                  <motion.button
                    key="new"
                    layout
                    type="button"
                    onClick={() => void create(true)}
                    className={cn(addTile, "flex min-h-[220px] flex-col items-center justify-center gap-2 text-[13.5px] font-medium")}
                  >
                    <Blob size={64} mood="happy" interactive={false} />
                    {t.home.example}
                  </motion.button>
                </AnimatePresence>
              </div>
            </section>
          )}
      </PageBody>
      <NotePicker open={picking} onClose={() => setPicking(false)} busy={busy} onPick={(id) => void fromNote(id)} />
    </>
  );
}

/** Choosing the note a new quiz is made from. */
function NotePicker({ open, onClose, busy, onPick }: { open: boolean; onClose: () => void; busy: string | null; onPick: (pageId: string) => void }) {
  const t = useMessages(quizText);
  const locale = useLocale();
  const { pages } = useWorkspace();
  const [query, setQuery] = useState("");
  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((p) => p.kind === "note" && !p.trashed_at && (!q || pageTitle(p.title, p.kind, locale).toLowerCase().includes(q))).slice(0, 60);
  }, [pages, query, locale]);
  return (
    <Dialog open={open} onClose={onClose} className="max-w-[480px]!" labelledBy="quiz-from-note">
      <div className="flex items-start gap-3 px-5 pb-3 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
          <NotebookText className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="quiz-from-note" className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink">
            {t.fromNote.title}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">{t.fromNote.hint}</p>
        </div>
      </div>
      <div className="px-5">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-blob">
          <Search className="size-4 text-ink-3" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.fromNote.search} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
        </label>
      </div>
      <ul className="mt-2 max-h-[min(380px,50vh)] overflow-y-auto px-2 pb-3">
        {notes.length === 0 && <li className={cn("px-3 py-6 text-center text-[13.5px]", midTone)}>{t.fromNote.none}</li>}
        {notes.map((p) => {
          const loading = busy === `note:${p.id}`;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => onPick(p.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] text-ink transition-colors hover:bg-hover disabled:opacity-60"
              >
                <PageIcon page={p} className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate">{pageTitle(p.title, p.kind, locale)}</span>
                {loading && <Blob size={22} mood="thinking" interactive={false} />}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

/** The three steps of a live quiz, on the start screen. */
function HowItWorks() {
  const t = useMessages(quizText);
  const icons = [Pencil, Tv, Smartphone];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {t.home.how.map((text, i) => {
        const Icon = icons[i];
        const style = styleAt(i);
        return (
          <li key={i} className={cn(card, "flex items-start gap-3 px-4 py-3")}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: style.color }}>
              <Icon className="size-4.5" />
            </span>
            <span className="text-[13.5px] leading-snug text-ink-2">
              <b className="mr-1 font-display text-ink">{i + 1}.</b>
              {text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** No quizzes yet: what a live quiz is, an example to try, and how it works. */
function EmptyStart({ onNew, onExample, busy }: { onNew: () => void; onExample: () => void; busy: string | null }) {
  const t = useMessages(quizText);
  return (
    <>
      <EmptyState
        art={
          <div className="flex items-end gap-3" aria-hidden>
            <Blob size={96} mood="excited" />
            {/* The game's four answer shapes, in their colours. */}
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="grid size-9 place-items-center rounded-lg shadow-card" style={{ background: styleAt(i).color }}>
                  <Shape shape={styleAt(i).shape} className="size-4.5" />
                </span>
              ))}
            </div>
          </div>
        }
        title={t.home.empty}
        body={t.home.intro}
        actions={
          <>
            <Button variant="blob" size="md" onClick={onExample} loading={busy === "example"}>
              <Play className="size-4" /> {t.home.example}
            </Button>
            <Button variant="secondary" size="md" onClick={onNew} loading={busy === "new"}>
              <Plus className="size-4" /> {t.home.create}
            </Button>
          </>
        }
      />
      <section aria-labelledby="quiz-how">
        <SectionHeader id="quiz-how" title={t.home.howTitle} />
        <HowItWorks />
      </section>
    </>
  );
}

function QuizCard({ quiz, index, busy, onHost, onDuplicate, onDelete }: { quiz: Quiz; index: number; busy: boolean; onHost: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const t = useMessages(quizText);
  const locale = useLocale();
  const router = useRouter();
  const title = quiz.title.trim() || t.untitled;
  const cover = quiz.cover ?? quiz.questions.find((q) => q.image)?.image ?? null;
  const style = styleAt(index);
  const ready = quiz.questions.filter((q) => !issuesOf(q).length).length;
  return (
    <motion.article layout variants={rise} initial="hidden" animate="shown" custom={index} exit={{ opacity: 0, scale: 0.95 }} className={cn(card, "group relative flex flex-col overflow-hidden transition-[box-shadow,border-color] hover:border-line-2 hover:shadow-pop")}>
      {/* No picture: the card's game colour, flat (no gradients on app pages). */}
      <Link href={`/quiz/${quiz.id}`} className="relative block h-[118px] overflow-hidden" style={{ background: cover ? undefined : style.color }}>
        {cover ? (
          <img src={cover} alt="" className="size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 opacity-90" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="transition-transform duration-300 motion-safe:group-hover:-translate-y-1" style={{ transitionDelay: `${i * 40}ms` }}>
                <Shape shape={styleAt(i).shape} className="size-9" fill="rgb(255 255 255 / 0.85)" />
              </span>
            ))}
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2.5 py-0.5 text-[11.5px] font-semibold text-white backdrop-blur">{t.questions(quiz.questions.length)}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3">
        <div className="flex items-start gap-2">
          <Link href={`/quiz/${quiz.id}`} className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          </Link>
          <Popover
            align="end"
            trigger={(props) => (
              <button {...props} type="button" className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9" aria-label={t.home.options(title)} title={t.home.options(title)}>
                <Ellipsis className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Pencil />}
                  onSelect={() => {
                    close();
                    router.push(`/quiz/${quiz.id}`);
                  }}
                >
                  {t.home.edit}
                </MenuItem>
                <MenuItem
                  icon={<Copy />}
                  onSelect={() => {
                    close();
                    onDuplicate();
                  }}
                >
                  {t.home.duplicate}
                </MenuItem>
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={() => {
                    close();
                    onDelete();
                  }}
                >
                  {t.home.delete}
                </MenuItem>
              </>
            )}
          </Popover>
        </div>
        {quiz.description && <p className="line-clamp-2 text-[13px] text-ink-2">{quiz.description}</p>}
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[12px] text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]">
          <span>{t.home.updated(formatDistanceToNow(new Date(quiz.updated_at), { addSuffix: true, locale: dateLocale(locale) }))}</span>
          {quiz.plays > 0 && (
            <span className="flex items-center gap-1">
              <Users className="size-3" /> {t.plays(quiz.plays)}
            </span>
          )}
        </p>
        {/* Plain, not violet: the page keeps one violet button (making a quiz). */}
        <Button variant="secondary" size="md" className={cn("mt-3", !ready && "opacity-60")} onClick={onHost} loading={busy}>
          <Play className="size-4" /> {t.home.host}
        </Button>
      </div>
    </motion.article>
  );
}
