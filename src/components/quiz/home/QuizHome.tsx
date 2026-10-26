"use client";

import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { BadgeQuestionMark, Copy, Ellipsis, NotebookText, Pencil, Play, Plus, Search, Smartphone, Trash2, Tv, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MenuItem, Popover } from "@/components/ui/Menu";
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
      <TopBar crumbs={[{ label: t.nav, icon: <BadgeQuestionMark className="size-3.5 text-ink-3" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-3 sm:px-8 lg:px-10 lg:pt-5">
          <motion.header initial="hidden" animate="shown" className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <motion.div variants={rise} custom={0} className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <BadgeQuestionMark className="size-3.5" /> {t.title}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em]">{t.home.heading}</h1>
              <p className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-ink-2">{t.home.intro}</p>
            </motion.div>
            <motion.div variants={rise} custom={1} className="flex flex-wrap gap-2">
              <a href="/play" target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-raised px-4 text-[14px] font-medium text-ink shadow-card hover:bg-hover/60">
                <Smartphone className="size-4" /> {t.home.join}
              </a>
              <Button variant="secondary" size="lg" onClick={() => setPicking(true)}>
                <NotebookText className="size-4" /> {t.fromNote.button}
              </Button>
              <Button variant="blob" size="lg" onClick={() => void create()} loading={busy === "new"}>
                <Plus className="size-4" /> {t.home.create}
              </Button>
            </motion.div>
          </motion.header>

          <HowItWorks />

          {quizzes.length === 0 ? (
            <EmptyHero onNew={() => void create()} onExample={() => void create(true)} busy={busy} />
          ) : (
            <section className="mt-7">
              {quizzes.length > 6 && (
                <label className="mb-4 flex h-10 max-w-[360px] items-center gap-2 rounded-xl border border-line bg-raised px-3 shadow-card focus-within:border-blob">
                  <Search className="size-4 text-ink-3" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.home.search} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
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
                    className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-2 text-[13.5px] text-ink-3 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink"
                  >
                    <Blob size={64} mood="happy" interactive={false} />
                    {t.home.example}
                  </motion.button>
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      </div>
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
        {notes.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-ink-3">{t.fromNote.none}</li>}
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

function HowItWorks() {
  const t = useMessages(quizText);
  const icons = [Pencil, Tv, Smartphone];
  return (
    <motion.ol initial="hidden" animate="shown" className="mt-6 grid gap-3 sm:grid-cols-3">
      {t.home.how.map((text, i) => {
        const Icon = icons[i];
        const style = styleAt(i);
        return (
          <motion.li key={i} variants={rise} custom={2 + i} className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: style.color }}>
              <Icon className="size-4.5" />
            </span>
            <span className="text-[13.5px] leading-snug text-ink-2">
              <b className="mr-1 font-display text-ink">{i + 1}.</b>
              {text}
            </span>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

function EmptyHero({ onNew, onExample, busy }: { onNew: () => void; onExample: () => void; busy: string | null }) {
  const t = useMessages(quizText);
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mt-8 overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(120%_100%_at_0%_0%,var(--blob-soft),var(--surface))] px-6 py-10 sm:px-10">
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <Blob size={150} mood="excited" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[24px] font-bold tracking-[-0.01em]">{t.home.empty}</h2>
          <p className="mt-1.5 max-w-[520px] text-[14.5px] text-ink-2">{t.home.emptyHint}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button variant="blob" size="lg" onClick={onExample} loading={busy === "example"}>
              <Play className="size-4" /> {t.home.example}
            </Button>
            <Button variant="secondary" size="lg" onClick={onNew} loading={busy === "new"}>
              <Plus className="size-4" /> {t.home.create}
            </Button>
          </div>
        </div>
        <div className="hidden grid-cols-2 gap-2 lg:grid" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <motion.span key={i} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.3 }} className="grid size-16 place-items-center rounded-2xl shadow-card" style={{ background: styleAt(i).color }}>
              <Shape shape={styleAt(i).shape} className="size-8" />
            </motion.span>
          ))}
        </div>
      </div>
    </motion.section>
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
    <motion.article layout variants={rise} initial="hidden" animate="shown" custom={index} exit={{ opacity: 0, scale: 0.95 }} className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-raised shadow-card transition-shadow hover:shadow-pop">
      <Link href={`/quiz/${quiz.id}`} className="relative block h-[118px] overflow-hidden" style={{ background: cover ? undefined : `linear-gradient(135deg, ${style.color}, ${style.deep})` }}>
        {cover ? (
          <img src={cover} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 opacity-90" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="transition-transform duration-300 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 40}ms` }}>
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
              <button {...props} type="button" className="-mr-1.5 grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label="…">
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
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[12px] text-ink-3">
          <span>{t.home.updated(formatDistanceToNow(new Date(quiz.updated_at), { addSuffix: true, locale: dateLocale(locale) }))}</span>
          {quiz.plays > 0 && (
            <span className="flex items-center gap-1">
              <Users className="size-3" /> {t.plays(quiz.plays)}
            </span>
          )}
        </p>
        <Button variant="blob" size="md" className={cn("mt-3", !ready && "opacity-60")} onClick={onHost} loading={busy}>
          <Play className="size-4" /> {t.home.host}
        </Button>
      </div>
    </motion.article>
  );
}
