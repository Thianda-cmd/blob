"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  CornerDownLeft,
  FilePlus2,
  FileUser,
  GraduationCap,
  House,
  ListChecks,
  ListPlus,
  Moon,
  Presentation,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { applyTheme } from "@/components/theme";
import { Kbd } from "@/components/ui/Kbd";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { subjectColor } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useMessages } from "@/i18n/client";
import { shellText } from "@/i18n/messages/shell";
import { resolveText } from "@/i18n/text";
import { CATALOG, topicHref } from "@/learn/catalog";
import type { PageKind } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { PageIcon } from "./Sidebar";

type Item = {
  id: string;
  group: "actions" | "pages" | "found" | "subjects" | "learn";
  label: string;
  hint?: string;
  /** Extra words that find an action (in both languages), e.g. "cv" for „Neuer Lebenslauf“. */
  keywords?: string;
  icon: ReactNode;
  run: () => void;
};

const CV_WORDS = "cv lebenslauf resume résumé bewerbung application praktikum internship ausbildung apprenticeship";

function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 80);
  const start = Math.max(0, i - 30);
  return (start > 0 ? "…" : "") + text.slice(start, i + q.length + 50).replace(/\s+/g, " ");
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{open && <Palette onClose={onClose} />}</AnimatePresence>, document.body);
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { pages, subjects, createPage } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(shellText).palette;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<{ id: string; title: string; kind: PageKind; icon: string | null; text: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim();

  // Full-text-ish search inside note contents (titles are matched locally).
  useEffect(() => {
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results
      setFound([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      const { data } = await createClient()
        .from("pages")
        .select("id, title, kind, icon, plain_text")
        .is("trashed_at", null)
        .ilike("plain_text", pattern)
        .order("updated_at", { ascending: false })
        .limit(8);
      if (!cancelled && data) setFound(data.map((d) => ({ id: d.id, title: d.title, kind: d.kind, icon: d.icon, text: snippet(d.plain_text, q) })));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const lower = q.toLowerCase();
    const match = (s: string) => !lower || s.toLowerCase().includes(lower);

    const actions: Item[] = [
      {
        id: "new-note",
        group: "actions",
        label: q ? t.newNoteNamed(q) : t.newNote,
        icon: <FilePlus2 />,
        run: async () => {
          onClose();
          const p = await createPage({ kind: "note", title: q });
          if (p) router.push(`/p/${p.id}`);
        },
      },
      {
        id: "new-deck",
        group: "actions",
        label: q ? t.newDeckNamed(q) : t.newDeck,
        icon: <Presentation />,
        run: async () => {
          onClose();
          const p = await createPage({ kind: "deck", title: q });
          if (p) router.push(`/p/${p.id}`);
        },
      },
      { id: "new-task", group: "actions", label: t.addTask, hint: t.addTaskHint, icon: <ListPlus />, run: () => go("/tasks?new=1") },
      // Not "new-…": a CV gets no name from the search, so it only shows when it matches.
      { id: "cv-new", group: "actions", label: t.newCv, hint: t.newCvHint, keywords: CV_WORDS, icon: <FileUser />, run: () => go("/cv?new=1") },
      { id: "home", group: "actions", label: t.goHome, icon: <House />, run: () => go("/home") },
      { id: "tasks", group: "actions", label: t.goTasks, icon: <ListChecks />, run: () => go("/tasks") },
      { id: "cv", group: "actions", label: t.goCv, keywords: CV_WORDS, icon: <FileUser />, run: () => go("/cv") },
      { id: "learn", group: "actions", label: t.goLearn, hint: t.goLearnHint, icon: <GraduationCap />, run: () => go("/learn") },
      { id: "settings", group: "actions", label: t.settings, icon: <Settings />, run: () => go("/settings") },
      { id: "trash", group: "actions", label: t.trash, icon: <Trash2 />, run: () => go("/trash") },
      {
        id: "theme",
        group: "actions",
        label: t.toggleDark,
        icon: <Moon />,
        run: () => {
          const dark = document.documentElement.dataset.theme === "dark";
          applyTheme(dark ? "light" : "dark");
          onClose();
        },
      },
    ];

    const pageItems: Item[] = [...pages]
      .filter((p) => match(pageTitle(p.title, p.kind, locale)))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, q ? 12 : 6)
      .map((p) => {
        const subject = subjects.find((s) => s.id === p.subject_id);
        return {
          id: `page-${p.id}`,
          group: "pages",
          label: pageTitle(p.title, p.kind, locale),
          hint: subject?.name,
          icon: <PageIcon page={p} />,
          run: () => go(`/p/${p.id}`),
        };
      });

    const titleIds = new Set(pageItems.map((i) => i.id));
    const contentItems: Item[] = found
      .filter((f) => !titleIds.has(`page-${f.id}`))
      .map((f) => ({
        id: `found-${f.id}`,
        group: "found",
        label: pageTitle(f.title, f.kind, locale),
        hint: f.text,
        icon: <PageIcon page={f} />,
        run: () => go(`/p/${f.id}`),
      }));

    const subjectItems: Item[] = subjects
      .filter((s) => q && match(s.name))
      .map((s) => ({
        id: `subject-${s.id}`,
        group: "subjects",
        label: s.name,
        icon: <span className="grid size-4 place-items-center">{s.emoji ?? <span className="size-2 rounded-full" style={{ background: subjectColor(s.color) }} />}</span>,
        run: () => go(`/subjects/${s.id}`),
      }));

    // Match the shown title and the German name from class (and the English one, so either language finds it).
    const topicItems: Item[] = CATALOG.filter((topic) => q && (match(resolveText(topic.title, locale)) || match(topic.de) || match(resolveText(topic.title, "en")))).map(
      (topic) => ({
        id: `topic-${topic.slug}`,
        group: "learn",
        label: resolveText(topic.title, locale),
        // In English the German name helps students recognise it from class; in German it would repeat the title.
        hint: locale === "en" ? topic.de : undefined,
        icon: <GraduationCap />,
        run: () => go(topicHref(topic)),
      }),
    );

    // Actions that match what was typed ("cv" → „Neuer Lebenslauf“) come before the "new note named …"
    // fallbacks, so Enter opens the CV builder instead of making a note called "cv".
    const hit = (a: Item) => match(a.label) || (lower.length > 1 && Boolean(a.keywords?.split(" ").some((w) => w.startsWith(lower))));
    const filteredActions = q
      ? [...actions.filter((a) => !a.id.startsWith("new") && hit(a)), ...actions.filter((a) => a.id.startsWith("new"))]
      : actions.slice(0, 3);
    return q ? [...pageItems, ...contentItems, ...subjectItems, ...topicItems, ...filteredActions] : [...filteredActions, ...pageItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pages, subjects, found, locale, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the selection on the first result while typing
    setActive(0);
  }, [q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[80] flex justify-center px-4 pt-[14vh]">
      <motion.div
        className="fixed inset-0 bg-[rgb(20_18_14/0.28)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label={t.label}
        initial={{ opacity: 0, scale: 0.94, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        className="relative flex h-fit max-h-[min(560px,70vh)] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-pop"
        onKeyDown={onKeyDown}
      >
        <div className="flex h-13 shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="size-4.5 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.placeholder}
            className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-ink-3">{t.nothing(q)}</div>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <div className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-medium text-ink-3">{t.groups[header]}</div>}
                <button
                  id={`palette-${item.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => item.run()}
                  className="relative flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13.5px]"
                >
                  {i === active && (
                    <motion.span
                      layoutId="palette-active"
                      className="absolute inset-0 rounded-lg bg-hover"
                      transition={{ type: "spring", stiffness: 700, damping: 45 }}
                    />
                  )}
                  <span className="relative grid size-4 shrink-0 place-items-center text-ink-3 [&_svg]:size-4">{item.icon}</span>
                  <span className={cn("relative min-w-0 shrink-[0.25] truncate", i === active ? "text-ink" : "text-ink-2")}>{item.label}</span>
                  {item.hint && <span className="relative ml-auto min-w-0 max-w-[55%] truncate text-[12px] text-ink-3">{item.hint}</span>}
                  {i === active && <CornerDownLeft className="relative size-3.5 shrink-0 text-ink-3" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex h-9 shrink-0 items-center gap-4 border-t border-line px-4 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {t.move}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> {t.open}
          </span>
          <span className="ml-auto hidden min-w-0 items-center gap-1.5 sm:flex">
            <Sun className="size-3 shrink-0" /> <span className="truncate">{t.tip}</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
