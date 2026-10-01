"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  CornerDownLeft,
  FilePlus2,
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
import { cn, pageTitle } from "@/lib/utils";
import { PageIcon } from "./Sidebar";

type Item = {
  id: string;
  group: "Actions" | "Pages" | "Found in notes" | "Subjects";
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
};

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
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<{ id: string; title: string; kind: "note" | "deck"; icon: string | null; text: string }[]>([]);
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
        group: "Actions",
        label: q ? `New note “${q}”` : "New note",
        icon: <FilePlus2 />,
        run: async () => {
          onClose();
          const p = await createPage({ kind: "note", title: q });
          if (p) router.push(`/p/${p.id}`);
        },
      },
      {
        id: "new-deck",
        group: "Actions",
        label: q ? `New presentation “${q}”` : "New presentation",
        icon: <Presentation />,
        run: async () => {
          onClose();
          const p = await createPage({ kind: "deck", title: q });
          if (p) router.push(`/p/${p.id}`);
        },
      },
      { id: "new-task", group: "Actions", label: "Add a task", hint: "Homework, exams, projects", icon: <ListPlus />, run: () => go("/tasks?new=1") },
      { id: "home", group: "Actions", label: "Go to Home", icon: <House />, run: () => go("/home") },
      { id: "tasks", group: "Actions", label: "Go to Tasks", icon: <ListChecks />, run: () => go("/tasks") },
      { id: "settings", group: "Actions", label: "Settings", icon: <Settings />, run: () => go("/settings") },
      { id: "trash", group: "Actions", label: "Trash", icon: <Trash2 />, run: () => go("/trash") },
      {
        id: "theme",
        group: "Actions",
        label: "Toggle dark mode",
        icon: <Moon />,
        run: () => {
          const dark = document.documentElement.dataset.theme === "dark";
          applyTheme(dark ? "light" : "dark");
          onClose();
        },
      },
    ];

    const pageItems: Item[] = [...pages]
      .filter((p) => match(pageTitle(p.title, p.kind)))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, q ? 12 : 6)
      .map((p) => {
        const subject = subjects.find((s) => s.id === p.subject_id);
        return {
          id: `page-${p.id}`,
          group: "Pages",
          label: pageTitle(p.title, p.kind),
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
        group: "Found in notes",
        label: pageTitle(f.title, f.kind),
        hint: f.text,
        icon: <PageIcon page={f} />,
        run: () => go(`/p/${f.id}`),
      }));

    const subjectItems: Item[] = subjects
      .filter((s) => q && match(s.name))
      .map((s) => ({
        id: `subject-${s.id}`,
        group: "Subjects",
        label: s.name,
        icon: <span className="grid size-4 place-items-center">{s.emoji ?? <span className="size-2 rounded-full" style={{ background: subjectColor(s.color) }} />}</span>,
        run: () => go(`/subjects/${s.id}`),
      }));

    const filteredActions = q ? actions.filter((a) => a.id.startsWith("new") || match(a.label)) : actions.slice(0, 3);
    return q ? [...pageItems, ...contentItems, ...subjectItems, ...filteredActions] : [...filteredActions, ...pageItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pages, subjects, found]);

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
        aria-label="Search"
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
            placeholder="Search notes, presentations, subjects…"
            className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-ink-3">Nothing matches “{q}”.</div>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <div className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-medium text-ink-3">{header}</div>}
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
                  <span className={cn("relative truncate", i === active ? "text-ink" : "text-ink-2")}>{item.label}</span>
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
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Sun className="size-3" /> Tip: search finds words inside your notes too
          </span>
        </div>
      </motion.div>
    </div>
  );
}
